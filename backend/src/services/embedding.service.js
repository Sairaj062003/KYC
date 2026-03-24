const { v5: uuidv5 } = require('uuid');
const { embed } = require('../config/ollama');
const { upsertPoints } = require('../config/vectorDb');

// Deterministic UUID namespace (randomly generated for this project)
const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate vector embeddings for a KYC document and phone number,
 * then store both as points in the Qdrant vector database.
 *
 * Two separate embeddings are created:
 * 1. Document embedding — combines extracted name, PAN, and document type
 * 2. Phone embedding — embeds the phone number for suspicious-number detection
 *
 * @param {string} kycId - UUID of the KYC document record
 * @param {{ full_name: string|null, pan_number: string|null, aadhaar_number: string|null, dob: string|null, document_type: string|null }} extractedData
 * @param {string} phoneNumber - User's validated phone number
 */
async function generateAndStore(kycId, extractedData, phoneNumber) {
  // Build text strings for embedding
  const docText = [
    extractedData.full_name,
    extractedData.pan_number,
    extractedData.aadhaar_number,
    extractedData.document_type,
  ]
    .filter(Boolean) // Remove null/undefined values
    .join(' ');

  const phoneText = phoneNumber || '';

  // Generate embeddings in parallel for efficiency
  const [docEmbedding, phoneEmbedding] = await Promise.all([
    docText ? embed(docText) : embed('unknown document'),
    phoneText ? embed(phoneText) : null,
  ]);

  // Build points array for Qdrant upsert
  const points = [];

  // Point 1: Document embedding (using deterministic UUID)
  const docPointId = uuidv5(`${kycId}_doc`, KYC_NAMESPACE);
  points.push({
    id: docPointId,
    vector: docEmbedding,
    payload: {
      kycId,
      type: 'document',
      name: extractedData.full_name,
      pan_number: extractedData.pan_number,
      aadhaar_number: extractedData.aadhaar_number,
      dob: extractedData.dob,
      document_type: extractedData.document_type,
    },
  });

  // Point 2: Phone embedding (using deterministic UUID)
  if (phoneEmbedding) {
    const phonePointId = uuidv5(`${kycId}_phone`, KYC_NAMESPACE);
    points.push({
      id: phonePointId,
      vector: phoneEmbedding,
      payload: {
        kycId,
        type: 'phone',
        phoneNumber,
      },
    });
  }

  // Upsert points into Qdrant (collection auto-created if missing)
  await upsertPoints(points);

  console.log(`[Embedding] Stored ${points.length} vectors for KYC ${kycId}`);
}

module.exports = { generateAndStore };
