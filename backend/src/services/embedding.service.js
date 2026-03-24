const { v5: uuidv5 } = require('uuid');
const { embed } = require('../config/ollama');
const { upsertPoints } = require('../config/vectorDb');

// Deterministic UUID namespace (randomly generated for this project)
const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate vector embeddings for a KYC document and phone number,
 * then store them as a SINGLE unified point in the Qdrant vector database.
 *
 * The unified embedding combines: name + id_number + dob + phone_number
 *
 * @param {string} kycId - UUID of the KYC document record
 * @param {{ full_name: string|null, pan_number: string|null, aadhaar_number: string|null, dob: string|null, document_type: string|null }} extractedData
 * @param {string} phoneNumber - User's validated phone number
 */
async function generateAndStore(kycId, extractedData, phoneNumber) {
  // Build single combined text string for embedding (id_number + name + dob + phone_number)
  const combinedText = [
    extractedData.full_name,
    extractedData.pan_number || extractedData.aadhaar_number,
    extractedData.dob,
    phoneNumber
  ]
    .filter(Boolean) // Remove null/undefined values
    .join(' ');

  // Generate single embedding
  const combinedEmbedding = combinedText ? await embed(combinedText) : null;

  // Build points array for Qdrant upsert
  const points = [];

  // Single Point: Combined embedding
  if (combinedEmbedding) {
    const pointId = uuidv5(kycId, KYC_NAMESPACE);
    points.push({
      id: pointId,
      vector: combinedEmbedding,
      payload: {
        kycId,
        type: 'kyc_record',
        name: extractedData.full_name,
        pan_number: extractedData.pan_number,
        aadhaar_number: extractedData.aadhaar_number,
        dob: extractedData.dob,
        document_type: extractedData.document_type,
        phoneNumber,
      },
    });
  }

  // Upsert point into Qdrant (collection auto-created if missing)
  await upsertPoints(points);

  console.log(`[Embedding] Stored ${points.length} vectors for KYC ${kycId}`);
}

module.exports = { generateAndStore };
