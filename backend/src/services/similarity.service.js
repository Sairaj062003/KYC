const { v5: uuidv5 } = require('uuid');
const pool = require('../config/db');
const { getPoints, searchSimilar } = require('../config/vectorDb');

const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

async function checkDuplicates(kycId) {
  let highestScore = 0;
  let matchedKycId = null;

  try {
    const pointId = uuidv5(kycId, KYC_NAMESPACE);
    const points = await getPoints([pointId]);

    if (!points || points.length === 0 || !points[0]?.vector) {
      console.warn(`[Similarity] No vector found for KYC ${kycId}`);
      return { similarity_score: 0, similarity_category: 'LOW' };
    }

    // Search top 6 — we'll manually remove self from results
    const results = await searchSimilar(points[0].vector, 6, null);

    console.log(`[Similarity] Raw results for KYC ${kycId}:`);
    results.forEach(r => console.log(`  id=${r.id} score=${r.score?.toFixed(4)} kyc_id=${r.payload?.kyc_id}`));

    for (const result of results) {
      // SELF-EXCLUSION: skip if result is the current document's own point
      if (result.id === pointId) continue;
      if (result.payload?.kyc_id === kycId) continue;
      if (result.payload?.point_uuid === pointId) continue;

      if (result.score > highestScore) {
        highestScore = result.score;
        matchedKycId = result.payload?.kyc_id;
      }
    }
  } catch (err) {
    console.error(`[Similarity] Error for KYC ${kycId}:`, err.message);
    return { similarity_score: 0, similarity_category: 'LOW' };
  }

  // Categorise score
  let category = 'LOW';
  if (highestScore >= 0.85) category = 'HIGH';
  else if (highestScore >= 0.60) category = 'MEDIUM';

  const isDuplicate = highestScore >= 0.85;

  try {
    await pool.query(
      `UPDATE kyc_documents
       SET similarity_score = $1, similarity_category = $2, is_duplicate = $3, updated_at = NOW()
       WHERE id = $4`,
      [highestScore, category, isDuplicate, kycId]
    );
  } catch (dbErr) {
    console.error(`[Similarity] DB update failed for KYC ${kycId}:`, dbErr.message);
  }

  console.log(`[Similarity] KYC ${kycId}: score=${highestScore.toFixed(4)}, category=${category}, matched=${matchedKycId || 'none'}`);
  return { similarity_score: highestScore, similarity_category: category };
}

module.exports = { checkDuplicates };
