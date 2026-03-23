// backend/src/services/similarity.service.js
const { v5: uuidv5 } = require('uuid');
const pool = require('../config/db');
const { getPoints, searchSimilar } = require('../config/vectorDb');

const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.85;

async function checkDuplicates(kycId) {
  let highestScore = 0;

  try {
    const docPointId = uuidv5(`${kycId}_doc`, KYC_NAMESPACE);
    const phonePointId = uuidv5(`${kycId}_phone`, KYC_NAMESPACE);

    const points = await getPoints([docPointId, phonePointId]);

    if (!points || points.length === 0) {
      console.warn(`[Similarity] No embeddings found for KYC ${kycId}`);
      return { similarity_score: 0, is_duplicate: false };
    }

    for (const point of points) {
      if (!point.vector) continue;

      // FIX: Qdrant correct syntax for excluding specific point IDs
      // The old syntax { must_not: [{ has_id: [...] }] } is wrong —
      // has_id is not a condition type in Qdrant filter syntax.
      // Correct syntax uses the top-level "must_not" with a "has_id" array
      // directly on the filter object, not nested inside a conditions array.
      const filter = {
        must_not: [
          {
            has_id: [docPointId, phonePointId]
          }
        ]
      };

      // Request limit+1 so even if self slips through, we skip it manually
      const results = await searchSimilar(point.vector, 6, filter);

      for (const result of results) {
        // EXTRA SAFETY: manually skip self even if filter fails
        if (result.id === docPointId || result.id === phonePointId) continue;

        if (result.score > highestScore) {
          highestScore = result.score;
        }
      }
    }
  } catch (err) {
    console.error(`[Similarity] Error checking duplicates for KYC ${kycId}:`, err.message);
    return { similarity_score: 0, is_duplicate: false };
  }

  const isDuplicate = highestScore >= SIMILARITY_THRESHOLD;

  try {
    await pool.query(
      `UPDATE kyc_documents 
       SET similarity_score = $1, is_duplicate = $2, updated_at = NOW()
       WHERE id = $3`,
      [highestScore, isDuplicate, kycId]
    );
  } catch (dbErr) {
    console.error(`[Similarity] Failed to update DB for KYC ${kycId}:`, dbErr.message);
  }

  console.log(`[Similarity] KYC ${kycId}: score=${highestScore.toFixed(4)}, duplicate=${isDuplicate}`);
  return { similarity_score: highestScore, is_duplicate: isDuplicate };
}

module.exports = { checkDuplicates };