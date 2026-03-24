const pool = require('../config/db');
const { generateAndStore } = require('../services/embedding.service');
const { ensureCollection } = require('../config/vectorDb');

/**
 * Maintenance script to re-populate the Qdrant vector database 
 * from existing KYC documents in PostgreSQL.
 */
async function recoverVectors() {
  console.log('[Recovery] Starting vector database recovery...');

  try {
    // 1. Ensure collection exists
    await ensureCollection();

    // 2. Fetch all KYC documents that have been successfully extracted
    // Join with users to get the phone number required for the phone embedding
    const query = `
      SELECT 
        k.id, 
        k.document_type, 
        k.extracted_name as full_name, 
        k.pan_number, 
        k.aadhaar_number, 
        k.dob,
        u.phone_number
      FROM kyc_documents k
      JOIN users u ON k.user_id = u.id
      WHERE k.status IN ('extracted', 'approved', 'rejected', 'reupload_requested')
    `;

    const { rows } = await pool.query(query);
    console.log(`[Recovery] Found ${rows.length} records to re-process.`);

    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
      try {
        const { id: kycId, phone_number: phoneNumber, ...extractedData } = row;

        console.log(`[Recovery] Processing KYC ${kycId}...`);

        // Use existing embedding service logic
        await generateAndStore(kycId, extractedData, phoneNumber);

        successCount++;
      } catch (err) {
        console.error(`[Recovery] Failed to process KYC ${row.id}:`, err.message);
        failCount++;
      }
    }

    console.log('[Recovery] Recovery completed.');
    console.log(`[Recovery] Success: ${successCount}`);
    console.log(`[Recovery] Failed:  ${failCount}`);

  } catch (err) {
    console.error('[Recovery] Fatal error during recovery:', err.stack);
  } finally {
    // Close the DB pool so the script can exit
    await pool.end();
  }
}

// Run the script
recoverVectors();
