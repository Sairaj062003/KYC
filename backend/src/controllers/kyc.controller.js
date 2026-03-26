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

    // Return 202 immediately — processing happens asynchronously
    res.status(202).json({
      message: 'Document received, processing started. Check /kyc/my for results.',
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
          // Auto-insert to new_submissions (audit trail) then immediately move to fraud DB
          const nsResult = await pool.query(
            `INSERT INTO new_submissions
               (user_id, file_path, original_name, document_type, extracted_name,
                pan_number, aadhaar_number, dob, ocr_raw_text, risk_category,
                matched_fraud_id, matched_fields, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'FRAUD',$10,$11,'added_to_fraud_db')
             RETURNING id`,
            [
              userId, filePath, originalName, finalFields.document_type, finalFields.name,
              finalFields.pan_number, finalFields.aadhaar_number, finalFields.dob,
              rawText || null, risk.matched_fraud_id,
              JSON.stringify(risk.matched_fields),
            ]
          );
          await addToFraudDb(nsResult.rows[0].id, null);
          console.log(`[Pipeline] FRAUD detected — automatically added to fraud DB.`);
        } else {
          // All other risk levels → staging only (never touches kyc_documents)
          await pool.query(
            `INSERT INTO new_submissions
               (user_id, file_path, original_name, document_type, extracted_name,
                pan_number, aadhaar_number, dob, ocr_raw_text, risk_category,
                matched_fraud_id, matched_fields, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending_review')`,
            [
              userId, filePath, originalName, finalFields.document_type, finalFields.name,
              finalFields.pan_number, finalFields.aadhaar_number, finalFields.dob,
              rawText || null, risk.risk_category, risk.matched_fraud_id,
              JSON.stringify(risk.matched_fields),
            ]
          );
          console.log(`[Pipeline] ${risk.risk_category} — Stored in staging (new_submissions).`);
        }
      } catch (pipelineErr) {
        console.error(`[Pipeline] Failed:`, pipelineErr.message, pipelineErr.stack);
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
