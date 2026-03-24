// backend/src/services/similarity.service.js
const { v5: uuidv5 } = require('uuid');
const pool = require('../config/db');
const { getPoints, searchSimilar } = require('../config/vectorDb');

const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

async function checkDuplicates(kycId) {
  let highestScore = 0;
  let matchReason = 'none';

  try {
    const pointId = uuidv5(kycId, KYC_NAMESPACE);

    const points = await getPoints([pointId]);

    if (!points || points.length === 0) {
      console.warn(`[Similarity] No embeddings found for KYC ${kycId}`);
      return { similarity_score: 0, similarity_category: 'LOW' };
    }

    const point = points[0];
    if (point && point.vector) {
      const filter = {
        must_not: [
          {
            key: 'kycId',
            match: { value: kycId }
          }
        ]
      };

      const results = await searchSimilar(point.vector, 5, filter);

      console.log(`[Similarity] search for KYC ${kycId}: ${results.length} results`);

      for (const result of results) {
        if (result.payload?.kycId === kycId) continue;

        if (result.score > highestScore) {
          highestScore = result.score;
          matchReason = `Match found with KYC ${result.payload?.kycId}`;
        }
      }
    }
  } catch (err) {
    console.error(`[Similarity] Error for KYC ${kycId}:`, err.message);
    return { similarity_score: 0, similarity_category: 'LOW' };
  }

  // Determine Categorization
  let category = 'LOW';
  if (highestScore >= 0.85) category = 'HIGH';
  else if (highestScore >= 0.60) category = 'MEDIUM';

  try {
    await pool.query(
      `UPDATE kyc_documents 
       SET similarity_score = $1, similarity_category = $2, is_duplicate = false, updated_at = NOW()
       WHERE id = $3`,
      [highestScore, category, kycId]
    );
  } catch (dbErr) {
    console.error(`[Similarity] Failed to update DB for KYC ${kycId}:`, dbErr.message);
  }

  console.log(`[Similarity] KYC ${kycId}: score=${highestScore.toFixed(4)}, category=${category}, reason=${matchReason}`);
  return { similarity_score: highestScore, similarity_category: category };
}

module.exports = { checkDuplicates };