// backend/src/services/riskEngine.service.js
const pool = require('../config/db');

/**
 * Compare a new submission against the fraud database (kyc_documents).
 * Uses the 5-tier risk matrix (highest priority wins):
 *
 *  FRAUD    — ALL FOUR match: ID + Name + DOB + Phone
 *  HIGH     — ID ONLY matches (PAN or Aadhaar), other fields differ
 *  MEDIUM   — Name + Phone OR Name + DOB (no ID match)
 *  LOW      — Only Name OR Only Phone (no qualifying combo)
 *  NO_RISK  — Only DOB OR no fields match
 *
 * @param {object} extractedFields  - { name, pan_number, aadhaar_number, dob, document_type }
 * @param {string} userPhone        - Registered phone (from users table) of the new submitter
 * @returns {{ risk_category, matched_fraud_id, matched_fields }}
 */
async function assessRisk(extractedFields, userPhone) {
  const { name, pan_number, aadhaar_number, dob } = extractedFields;

  // Fetch all fraud records with their owning user's phone
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
  let matchedFraudId = null;
  let matchedFields = [];

  for (const fraud of fraudRecords.rows) {
    const matches = [];

    // ID match — PAN or Aadhaar (case-insensitive)
    const idMatch =
      (pan_number && fraud.pan_number &&
        pan_number.trim().toUpperCase() === fraud.pan_number.trim().toUpperCase()) ||
      (aadhaar_number && fraud.aadhaar_number &&
        aadhaar_number.replace(/\s/g, '') === fraud.aadhaar_number.replace(/\s/g, ''));
    if (idMatch) matches.push('id');

    // Name match — case-insensitive, trimmed
    const nameMatch =
      name && fraud.extracted_name &&
      name.trim().toLowerCase() === fraud.extracted_name.trim().toLowerCase();
    if (nameMatch) matches.push('name');

    // DOB match — normalize both sides to YYYY-MM-DD
    let dobMatch = false;
    if (dob && fraud.dob) {
      try {
        const newDob = new Date(dob).toISOString().split('T')[0];
        const fraudDob = new Date(fraud.dob).toISOString().split('T')[0];
        dobMatch = newDob === fraudDob;
      } catch (_) { /* skip bad dates */ }
    }
    if (dobMatch) matches.push('dob');

    // Phone match — compare new submitter's registered phone with fraud record owner's phone
    const phoneMatch =
      userPhone && fraud.phone_number &&
      userPhone.replace(/\s/g, '') === fraud.phone_number.replace(/\s/g, '');
    if (phoneMatch) matches.push('phone');

    if (matches.length === 0) continue;

    // Determine the risk category for this fraud record
    const hasId    = matches.includes('id');
    const hasName  = matches.includes('name');
    const hasDob   = matches.includes('dob');
    const hasPhone = matches.includes('phone');

    let category = 'NO_RISK';

    if (hasId && hasName && hasDob && hasPhone) {
      // All four match → FRAUD
      category = 'FRAUD';
    } else if (hasId) {
      // ID matches but not all four → HIGH
      category = 'HIGH';
    } else if (hasName && (hasPhone || hasDob)) {
      // Name + Phone OR Name + DOB (no ID) → MEDIUM
      category = 'MEDIUM';
    } else if (hasName || hasPhone) {
      // Only Name OR only Phone (no ID, no qualifying combo) → LOW
      category = 'LOW';
    } else {
      // Only DOB or isolated match → NO_RISK
      category = 'NO_RISK';
    }

    // Keep the highest risk found across all fraud records
    if (priority[category] > priority[highestRisk]) {
      highestRisk = category;
      matchedFraudId = fraud.id;
      matchedFields = matches;
    }

    // Short-circuit: can't get higher than FRAUD
    if (highestRisk === 'FRAUD') break;
  }

  console.log(`[RiskEngine] Assessment complete — Category: ${highestRisk}, Fields: [${matchedFields.join(',')}]`);

  return {
    risk_category: highestRisk,
    matched_fraud_id: matchedFraudId,
    matched_fields: matchedFields,
  };
}

module.exports = { assessRisk };
