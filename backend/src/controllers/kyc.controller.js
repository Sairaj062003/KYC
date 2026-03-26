const pool = require('../config/db');
const ocrService = require('../services/ocr.service');
const llmService = require('../services/llm.service');
const { preprocessImage } = require('../services/imagePreprocessor.service');
const { extractWithVisionLLM } = require('../services/visionExtractor.service');
const { validateAndMerge } = require('../services/fieldValidator.service');
const { assessRisk } = require('../services/riskEngine.service');
const { addToFraudDb } = require('../services/fraudDb.service');

/**
 * POST /kyc/upload
 * Upload a KYC document for processing. Returns 202 immediately
 * and triggers the async OCR → LLM → Risk Engine pipeline.
 *
 * Documents are NEVER written to kyc_documents directly.
 * All submissions land in new_submissions first.
 * Only FRAUD (auto) and HIGH RISK (admin-confirmed) documents move to kyc_documents.
 */
async function upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.userId;
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const phoneNumberInput = req.body.phone_number;

    if (!phoneNumberInput || !/^[6-9]\d{9}$/.test(phoneNumberInput)) {
      return res.status(400).json({ error: 'Valid 10-digit Indian phone number is required' });
    }

    // Fetch the user's registered phone number for risk matching
    const userRes = await pool.query('SELECT phone_number FROM users WHERE id = $1', [userId]);
    const registeredPhone = userRes.rows[0]?.phone_number || phoneNumberInput;

    // Insert a placeholder into new_submissions immediately so the frontend can poll
    console.log(`[Pipeline] Creating placeholder for user: ${userId}`);
    const placeholderRes = await pool.query(
      `INSERT INTO new_submissions
         (user_id, file_path, original_name, status, risk_category)
       VALUES ($1, $2, $3, 'processing', 'NO_RISK')
       RETURNING id`,
      [userId, filePath, originalName]
    );
    const submissionId = placeholderRes.rows[0].id;
    console.log(`[Pipeline] Registered submission: ${submissionId}`);

    // Return 202 immediately with the submission ID for polling
    res.status(202).json({
      kycId: submissionId,
      message: 'Document received, processing started',
    });

    // ── Async Processing Pipeline ────────────────────────────────
    setImmediate(async () => {
      try {
        // Layer 1: Image Pre-processing (OpenCV)
        console.log(`[Pipeline] Upload for user ${userId}: Layer 1 — Pre-processing image...`);
        const cleanImagePath = await preprocessImage(filePath);

        // Layer 2: Vision LLM Extraction (Gemini)
        console.log(`[Pipeline] Layer 2 — Vision LLM extraction...`);
        let visionResult = null;
        try {
          visionResult = await extractWithVisionLLM(cleanImagePath);
        } catch (err) {
          console.warn(`[Pipeline] Vision LLM failed:`, err.message);
        }

        // Layer 3: Tesseract + Ollama Fallback
        let ollamaResult = null;
        let rawText = '';
        const isVisionComplete = visionResult?.name &&
          (visionResult?.pan_number || visionResult?.aadhaar_number) &&
          visionResult?.dob;

        if (!isVisionComplete) {
          console.log(`[Pipeline] Layer 3 — Vision incomplete, starting Tesseract fallback...`);
          rawText = await ocrService.extractText(cleanImagePath);
          ollamaResult = await llmService.extractStructuredData(rawText);
        }

        // Layer 4: Validation + Merge
        console.log(`[Pipeline] Layer 4 — Validating and merging results...`);
        const finalFields = validateAndMerge(visionResult, ollamaResult);

        // ── RISK ENGINE ───────────────────────────────────────────
        console.log(`[Pipeline] Running Risk Engine...`);
        const risk = await assessRisk(finalFields, registeredPhone);
        console.log(`[Pipeline] Risk: ${risk.risk_category} | Fields: [${risk.matched_fields.join(',')}]`);

        if (risk.risk_category === 'FRAUD') {
          // Update the placeholder row with extracted data and mark as FRAUD
          await pool.query(
            `UPDATE new_submissions
             SET document_type=$1, extracted_name=$2, pan_number=$3, aadhaar_number=$4,
                 dob=$5, ocr_raw_text=$6, risk_category='FRAUD',
                 matched_fraud_id=$7, matched_fields=$8, similarity_score=$9,
                 status='added_to_fraud_db', updated_at=NOW()
             WHERE id=$10`,
            [
              finalFields.document_type, finalFields.name,
              finalFields.pan_number, finalFields.aadhaar_number, finalFields.dob,
              rawText || null, risk.matched_fraud_id,
              JSON.stringify(risk.matched_fields), risk.similarity_score, submissionId,
            ]
          );
          // Move to fraud DB automatically
          await addToFraudDb(submissionId, null);
          console.log(`[Pipeline] FRAUD detected — automatically added to fraud DB.`);
        } else {
          // All other risk levels — update the placeholder in staging
          await pool.query(
            `UPDATE new_submissions
             SET document_type=$1, extracted_name=$2, pan_number=$3, aadhaar_number=$4,
                 dob=$5, ocr_raw_text=$6, risk_category=$7,
                 matched_fraud_id=$8, matched_fields=$9, similarity_score=$10,
                 status='pending_review', updated_at=NOW()
             WHERE id=$11`,
            [
              finalFields.document_type, finalFields.name,
              finalFields.pan_number, finalFields.aadhaar_number, finalFields.dob,
              rawText || null, risk.risk_category, risk.matched_fraud_id,
              JSON.stringify(risk.matched_fields), risk.similarity_score, submissionId,
            ]
          );
          console.log(`[Pipeline] ${risk.risk_category} — Stored in staging (new_submissions).`);
        }
      } catch (pipelineErr) {
        console.error(`[Pipeline] Failed:`, pipelineErr.message, pipelineErr.stack);
        // Mark the placeholder as failed so the frontend stops polling
        try {
          await pool.query(
            `UPDATE new_submissions SET status='extraction_failed', updated_at=NOW() WHERE id=$1`,
            [submissionId]
          );
        } catch (_) { /* best-effort */ }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /kyc/my
 * Get all submissions by the authenticated user from the new_submissions staging table.
 */
async function getMyDocuments(req, res, next) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT ns.id, ns.original_name, ns.document_type, ns.extracted_name,
              ns.pan_number, ns.aadhaar_number, ns.dob, ns.risk_category,
              ns.status, ns.fraud_db_added, ns.uploaded_at, ns.updated_at,
              (SELECT reason FROM new_submission_reviews WHERE submission_id = ns.id
               ORDER BY created_at DESC LIMIT 1) as admin_reason
       FROM new_submissions ns
       WHERE ns.user_id = $1
       ORDER BY ns.uploaded_at DESC`,
      [userId]
    );

    res.status(200).json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /kyc/status/:id
 * Poll the status of a specific submission (by new_submissions.id).
 */
async function getStatus(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check new_submissions first (all new uploads land here)
    const result = await pool.query(
      `SELECT ns.id, ns.status, ns.document_type, ns.extracted_name, ns.pan_number,
              ns.aadhaar_number, ns.dob, ns.risk_category, ns.fraud_db_added,
              ns.uploaded_at, ns.updated_at,
              (SELECT reason FROM new_submission_reviews WHERE submission_id = ns.id
               ORDER BY created_at DESC LIMIT 1) as admin_reason
       FROM new_submissions ns
       WHERE ns.id = $1 AND ns.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, getStatus, getMyDocuments };
