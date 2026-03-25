const { v5: uuidv5 } = require('uuid');
const { embed } = require('../config/ollama');
const { upsertPoints } = require('../config/vectorDb');

const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate vector embeddings for a KYC document and store in Qdrant.
 * Uses a single point per KYC with proper payload fields for filtering.
 *
 * @param {string} kycId - UUID of the KYC document record
 * @param {{ full_name: string|null, pan_number: string|null, aadhaar_number: string|null, dob: string|null, document_type: string|null }} extractedData
 * @param {string} phoneNumber - User's validated phone number
 */
async function generateAndStore(kycId, extractedData, phoneNumber) {
  // Build combined document text for a single embedding
  const docText = [
    extractedData.full_name,
    extractedData.pan_number,
    extractedData.aadhaar_number,
    extractedData.dob,
    phoneNumber,
    extractedData.document_type,
  ].filter(Boolean).join(' ') || 'unknown document';

  const docEmbedding = await embed(docText);

  // Use deterministic UUID so we can retrieve it later
  const pointId = uuidv5(kycId, KYC_NAMESPACE);

  await upsertPoints([{
    id: pointId,
    vector: docEmbedding,
    payload: {
      kyc_id: kycId,        // NOTE: use kyc_id (underscore) not kycId for Qdrant filter
      point_uuid: pointId,  // store the point ID in payload too for manual exclusion
      name: extractedData.full_name || null,
      pan_number: extractedData.pan_number || null,
      aadhaar_number: extractedData.aadhaar_number || null,
      document_type: extractedData.document_type || null,
    },
  }]);

  console.log(`[Embedding] Stored 1 vector for KYC ${kycId} (point: ${pointId})`);
}

module.exports = { generateAndStore };
