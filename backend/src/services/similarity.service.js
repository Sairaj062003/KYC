const { v5: uuidv5 } = require('uuid');
const pool = require('../config/db');
const { getPoints, searchSimilar } = require('../config/vectorDb');

// Deterministic UUID namespace (must match embedding.service.js)
const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.85;

/**
 * Check for duplicate KYC submissions by running vector similarity searches
 * against existing document and phone embeddings in Qdrant.
 *
 * Performs two searches:
 * 1. Document similarity — finds documents with similar extracted data
 * 2. Phone similarity — finds submissions with similar phone numbers
 *
 * The highest similarity score across both searches is used to determine
 * whether the submission is a potential duplicate.
 *
 * @param {string} kycId - UUID of the KYC document to check
 * @returns {{ similarity_score: number, is_duplicate: boolean }}
 */
async function checkDuplicates(kycId) {
  let highestScore = 0;

  try {
    // Retrieve the stored embeddings for this KYC submission using deterministic UUIDs
    const docPointId = uuidv5(`${kycId}_doc`, KYC_NAMESPACE);
    const phonePointId = uuidv5(`${kycId}_phone`, KYC_NAMESPACE);

    const points = await getPoints([docPointId, phonePointId]);

    if (!points || points.length === 0) {
      console.warn(`[Similarity] No embeddings found for KYC ${kycId}`);
      return { similarity_score: 0, is_duplicate: false };
    }

    // Run similarity searches for each embedding type
    for (const point of points) {
      if (!point.vector) continue;

      // Search for similar vectors, excluding self (top 5 results)
      const results = await searchSimilar(point.vector, 6, {
        must_not: [
          {
            key: 'kycId',
            match: { value: kycId },
          },
        ],
      });

      // Find the highest score among results
      for (const result of results) {
        if (result.score > highestScore) {
          highestScore = result.score;
        }
      }
    }
  } catch (err) {
    console.error(`[Similarity] Error checking duplicates for KYC ${kycId}:`, err.message);
    // Don't fail the entire pipeline — just report no duplicates
    return { similarity_score: 0, is_duplicate: false };
  }

  const isDuplicate = highestScore >= SIMILARITY_THRESHOLD;

  // Update the KYC document record in PostgreSQL
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

  console.log(
    `[Similarity] KYC ${kycId}: score=${highestScore.toFixed(4)}, duplicate=${isDuplicate}`
  );

  return {
    similarity_score: highestScore,
    is_duplicate: isDuplicate,
  };
}

module.exports = { checkDuplicates };
