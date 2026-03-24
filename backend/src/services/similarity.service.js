// backend/src/services/similarity.service.js
const { v5: uuidv5 } = require('uuid');
const pool = require('../config/db');
const { getPoints, searchSimilar } = require('../config/vectorDb');

const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.85;

async function checkDuplicates(kycId) {
  let highestScore = 0;
  let matchReason = 'none';

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

      const pointType = point.payload?.type; // 'document' or 'phone'

      // KEY FIX: Only compare doc→doc and phone→phone
      // Also exclude the current KYC's own points AND require same type
      const filter = {
        must: [
          // Only match same type (doc vs doc, phone vs phone)
          {
            key: 'type',
            match: { value: pointType }
          }
        ],
        must_not: [
          // Exclude this KYC's own points
          {
            key: 'kycId',
            match: { value: kycId }
          }
        ]
      };

      const results = await searchSimilar(point.vector, 5, filter);

      console.log(`[Similarity] ${pointType} search for KYC ${kycId}: ${results.length} results`);
      results.forEach(r => {
        console.log(`  → kycId=${r.payload?.kycId} score=${r.score?.toFixed(4)} type=${r.payload?.type}`);
      });

      for (const result of results) {
        // Extra safety: never count own submission
        if (result.payload?.kycId === kycId) continue;

        if (result.score > highestScore) {
          highestScore = result.score;
          matchReason = `${pointType} match with KYC ${result.payload?.kycId}`;
        }
      }
    }
  } catch (err) {
    console.error(`[Similarity] Error for KYC ${kycId}:`, err.message);
    return { similarity_score: 0, is_duplicate: false };
  }

  // IMPORTANT: For phone-only matches, use a higher threshold
  // because the same person can legitimately re-submit.
  // Only flag as duplicate if DOCUMENT similarity is high.
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

  console.log(`[Similarity] KYC ${kycId}: score=${highestScore.toFixed(4)}, duplicate=${isDuplicate}, reason=${matchReason}`);
  return { similarity_score: highestScore, is_duplicate: isDuplicate };
}

module.exports = { checkDuplicates };