// backend/src/services/riskEngine.service.js
const pool = require('../config/db');
const { searchSimilar } = require('../config/vectorDb');
const { embed } = require('../config/ollama');

/**
 * Compare a new submission against the fraud database (kyc_documents).
 * Uses a hybrid approach:
 * 1. Numerical vector similarity (Qdrant)
 * 2. 5-tier field match risk matrix (Highest priority wins)
 *
 * @param {object} extractedFields  - { name, pan_number, aadhaar_number, dob, document_type }
 * @param {string} userPhone        - Registered phone (from users table) of the new submitter
 * @returns {{ risk_category, matched_fraud_id, matched_fields, similarity_score }}
 */
async function assessRisk(extractedFields, userPhone) {
  const { name, pan_number, aadhaar_number, dob, document_type } = extractedFields;

  // --- 1. Vector Similarity Search ---
  let similarityScore = 0.0;
  let vectorMatchId = null;

  const docText = [name, pan_number, aadhaar_number, dob, document_type].filter(Boolean).join(' ');
  if (docText) {
    try {
      const embedding = await embed(docText);
      const searchResults = await searchSimilar(embedding, 1); // Get top match from kyc_embeddings
      if (searchResults.length > 0) {
        similarityScore = searchResults[0].score;
        vectorMatchId = searchResults[0].payload.kyc_id;
      }
    } catch (err) {
      console.warn(`[RiskEngine] Vector search failed: ${err.message}`);
    }
  }

  // --- 2. Field Match Matrix ---
  const fraudRecords = await pool.query(
    `SELECT kd.id, kd.extracted_name, kd.pan_number, kd.aadhaar_number, kd.dob,
            u.phone_number
     FROM kyc_documents kd
     JOIN users u ON kd.user_id = u.id
     WHERE kd.extracted_name IS NOT NULL`,
    []
  );

  const priority = { FRAUD: 5, HIGH: 4, MEDIUM: 3, LOW: 2, NO_RISK: 1 };
  let highestRisk = 'NO_RISK';
  let matchedFraudId = vectorMatchId; // Default to vector match if no field match higher
  let matchedFields = [];

  for (const fraud of fraudRecords.rows) {
    const matches = [];

    // ID match
    const idMatch =
      (pan_number && fraud.pan_number &&
        pan_number.trim().toUpperCase() === fraud.pan_number.trim().toUpperCase()) ||
      (aadhaar_number && fraud.aadhaar_number &&
        aadhaar_number.replace(/\s/g, '') === fraud.aadhaar_number.replace(/\s/g, ''));
    if (idMatch) matches.push('id');

    // Name match
    const nameMatch =
      name && fraud.extracted_name &&
      name.trim().toLowerCase() === fraud.extracted_name.trim().toLowerCase();
    if (nameMatch) matches.push('name');

    // DOB match
    let dobMatch = false;
    if (dob && fraud.dob) {
      try {
        const newDob = new Date(dob).toISOString().split('T')[0];
        const fraudDob = new Date(fraud.dob).toISOString().split('T')[0];
        dobMatch = newDob === fraudDob;
      } catch (_) {}
    }
    if (dobMatch) matches.push('dob');

    // Phone match
    const phoneMatch =
      userPhone && fraud.phone_number &&
      userPhone.replace(/\s/g, '') === fraud.phone_number.replace(/\s/g, '');
    if (phoneMatch) matches.push('phone');

    if (matches.length === 0) continue;

    const hasId    = matches.includes('id');
    const hasName  = matches.includes('name');
    const hasDob   = matches.includes('dob');
    const hasPhone = matches.includes('phone');

    let category = 'NO_RISK';
    if (hasId && hasName && hasDob && hasPhone) category = 'FRAUD';
    else if (hasId) category = 'HIGH';
    else if (hasName && (hasPhone || hasDob)) category = 'MEDIUM';
    else if (hasName || hasPhone) category = 'LOW';

    if (priority[category] > priority[highestRisk]) {
      highestRisk = category;
      matchedFraudId = fraud.id;
      matchedFields = matches;
    }
    if (highestRisk === 'FRAUD') break;
  }

  // If vector similarity is very high (> 0.9) but no field matches, escalate to HIGH
  if (highestRisk === 'NO_RISK' && similarityScore > 0.90) {
    highestRisk = 'HIGH';
    matchedFields.push('visual_similarity');
  }

  return {
    risk_category: highestRisk,
    matched_fraud_id: matchedFraudId,
    matched_fields: matchedFields,
    similarity_score: similarityScore,
  };
}

module.exports = { assessRisk };
