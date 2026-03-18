const pool = require('../config/db');
const ocrService = require('../services/ocr.service');
const llmService = require('../services/llm.service');
const embeddingService = require('../services/embedding.service');
const similarityService = require('../services/similarity.service');

/**
 * POST /kyc/upload
 * Upload a KYC document for processing. Returns 202 immediately
 * and triggers the async OCR → LLM → Embedding → Similarity pipeline.
 */
async function upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.userId;
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    // Insert KYC document record with status = 'processing'
    const result = await pool.query(
      `INSERT INTO kyc_documents (user_id, file_path, original_name, status)
       VALUES ($1, $2, $3, 'processing')
       RETURNING id`,
      [userId, filePath, originalName]
    );

    const kycId = result.rows[0].id;

    // Return 202 immediately — processing happens asynchronously
    res.status(202).json({
      kycId,
      message: 'Document received, processing started',
    });

    // Fetch user phone number for embedding
    const userResult = await pool.query(
      'SELECT phone_number FROM users WHERE id = $1',
      [userId]
    );
    const phoneNumber = userResult.rows[0]?.phone_number || '';

    // ── Async Processing Pipeline ──────────────────────────
    // Uses setImmediate to not block the event loop
    setImmediate(async () => {
      try {
        // Step 1: OCR — Extract raw text from the document
        console.log(`[Pipeline] KYC ${kycId}: Starting OCR...`);
        const rawText = await ocrService.extractText(filePath);

        // Step 2: LLM — Extract structured data from raw text
        console.log(`[Pipeline] KYC ${kycId}: Starting LLM extraction...`);
        const extracted = await llmService.extractStructuredData(rawText);

        // Step 3: Update database with extracted data
        await pool.query(
          `UPDATE kyc_documents
           SET extracted_name = $1,
               pan_number = $2,
               dob = $3,
               document_type = $4,
               ocr_raw_text = $5,
               status = 'extracted',
               updated_at = NOW()
           WHERE id = $6`,
          [
            extracted.full_name,
            extracted.pan_number,
            extracted.dob,
            extracted.document_type,
            rawText,
            kycId,
          ]
        );

        // Step 4: Generate and store embeddings in Qdrant
        console.log(`[Pipeline] KYC ${kycId}: Generating embeddings...`);
        await embeddingService.generateAndStore(kycId, extracted, phoneNumber);

        // Step 5: Check for duplicates via similarity search
        console.log(`[Pipeline] KYC ${kycId}: Checking duplicates...`);
        const similarity = await similarityService.checkDuplicates(kycId);

        console.log(
          `[Pipeline] KYC ${kycId}: Processing complete. ` +
          `Score: ${similarity.similarity_score.toFixed(4)}, ` +
          `Duplicate: ${similarity.is_duplicate}`
        );
      } catch (pipelineErr) {
        // On any pipeline error — mark document as extraction_failed
        console.error(
          `[Pipeline] KYC ${kycId}: Processing failed:`,
          pipelineErr.message,
          pipelineErr.stack
        );
        try {
          await pool.query(
            `UPDATE kyc_documents
             SET status = 'extraction_failed', updated_at = NOW()
             WHERE id = $1`,
            [kycId]
          );
        } catch (dbErr) {
          console.error(`[Pipeline] Failed to update status for KYC ${kycId}:`, dbErr.message);
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /kyc/status/:id
 * Get the current processing status of a KYC document.
 * Users can only check status of their own documents.
 */
async function getStatus(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, status, document_type, extracted_name, pan_number, dob,
              similarity_score, is_duplicate, uploaded_at, updated_at
       FROM kyc_documents
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'KYC document not found' });
    }

    res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /kyc/my
 * Get all KYC documents submitted by the authenticated user.
 */
async function getMyDocuments(req, res, next) {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, original_name, document_type, extracted_name, status,
              similarity_score, is_duplicate, uploaded_at, updated_at
       FROM kyc_documents
       WHERE user_id = $1
       ORDER BY uploaded_at DESC`,
      [userId]
    );

    res.status(200).json({ data: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, getStatus, getMyDocuments };
