// backend/src/services/fraudDb.service.js
const pool = require('../config/db');
const { embed } = require('../config/ollama');
const { upsertPoints } = require('../config/vectorDb');
const { v5: uuidv5 } = require('uuid');

const KYC_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const FRAUD_COLLECTION = 'kyc_embeddings'; // existing fraud Qdrant collection

/**
 * Move a new_submissions record into the fraud database.
 * Called automatically for FRAUD category, or manually by admin for HIGH RISK.
 *
 * Steps:
 *   1. Insert a new row into kyc_documents (fraud DB)
 *   2. Generate embedding and upsert into kyc_embeddings (Qdrant)
 *   3. Mark new_submissions.fraud_db_added = true, status = 'added_to_fraud_db'
 *   4. Log the action in new_submission_reviews (if admin triggered)
 *
 * @param {string} submissionId - UUID of the new_submissions record
 * @param {string|null} adminId - UUID of admin who triggered (null for auto-FRAUD)
 */
async function addToFraudDb(submissionId, adminId) {
  // Fetch the staging record + its owner's phone number
  const subResult = await pool.query(
    `SELECT ns.*, u.phone_number
     FROM new_submissions ns
     JOIN users u ON ns.user_id = u.id
     WHERE ns.id = $1`,
    [submissionId]
  );
  if (subResult.rows.length === 0) throw new Error('Submission not found: ' + submissionId);
  const sub = subResult.rows[0];

  // 1. Insert into kyc_documents (fraud database)
  const fraudInsert = await pool.query(
    `INSERT INTO kyc_documents
       (user_id, file_path, original_name, document_type,
        extracted_name, pan_number, aadhaar_number, dob,
        ocr_raw_text, status, similarity_category, is_duplicate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'fraud', 'HIGH', true)
     RETURNING id`,
    [
      sub.user_id, sub.file_path, sub.original_name, sub.document_type,
      sub.extracted_name, sub.pan_number, sub.aadhaar_number, sub.dob,
      sub.ocr_raw_text,
    ]
  );
  const fraudKycId = fraudInsert.rows[0].id;

  // 2. Generate embedding and add to kyc_embeddings Qdrant collection
  const docText = [
    sub.extracted_name,
    sub.pan_number,
    sub.aadhaar_number,
    sub.dob,
    sub.phone_number,
    sub.document_type,
  ].filter(Boolean).join(' ');

  if (docText) {
    try {
      const embedding = await embed(docText);
      const pointId = uuidv5(fraudKycId, KYC_NAMESPACE);
      await upsertPoints(
        [{
          id: pointId,
          vector: embedding,
          payload: {
            kyc_id: fraudKycId,
            point_uuid: pointId,
            name: sub.extracted_name,
            pan_number: sub.pan_number,
            aadhaar_number: sub.aadhaar_number,
            document_type: sub.document_type,
          },
        }],
        FRAUD_COLLECTION
      );
      console.log(`[FraudDB] Embedded and stored in Qdrant: ${fraudKycId}`);
    } catch (embedErr) {
      console.warn(`[FraudDB] Embedding failed (non-fatal): ${embedErr.message}`);
    }
  }

  // 3. Mark the staging record as moved to fraud DB
  await pool.query(
    `UPDATE new_submissions
     SET fraud_db_added = true, status = 'added_to_fraud_db', updated_at = NOW()
     WHERE id = $1`,
    [submissionId]
  );

  // 4. Log admin action (skip if auto-triggered by FRAUD category)
  if (adminId) {
    await pool.query(
      `INSERT INTO new_submission_reviews (submission_id, admin_id, action, reason)
       VALUES ($1, $2, 'add_to_fraud_db', 'High risk confirmed by admin')`,
      [submissionId, adminId]
    );
  }

  console.log(`[FraudDB] Submission ${submissionId} → fraud DB as kyc_document ${fraudKycId}`);
  return { fraud_kyc_id: fraudKycId };
}

module.exports = { addToFraudDb };
