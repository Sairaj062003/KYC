// backend/src/controllers/newSubmission.controller.js
const pool = require('../config/db');
const { addToFraudDb } = require('../services/fraudDb.service');

/**
 * GET /admin/submissions
 * List all new submissions with optional risk/status filters, sorted by risk priority.
 */
async function listSubmissions(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const riskFilter = req.query.risk || null;
    const statusFilter = req.query.status || null;

    const params = [];
    const where = [];
    if (riskFilter)   { params.push(riskFilter);   where.push(`ns.risk_category = $${params.length}`); }
    if (statusFilter) { params.push(statusFilter); where.push(`ns.status = $${params.length}`); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM new_submissions ns ${whereClause}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT ns.id, ns.user_id, u.email AS user_email, u.name AS user_name,
              u.phone_number, ns.original_name, ns.document_type,
              ns.extracted_name, ns.pan_number, ns.aadhaar_number, ns.dob,
              ns.risk_category, ns.matched_fields, ns.matched_fraud_id,
              ns.status, ns.fraud_db_added, ns.uploaded_at, ns.updated_at
       FROM new_submissions ns
       JOIN users u ON ns.user_id = u.id
       ${whereClause}
       ORDER BY ns.uploaded_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: dataRes.rows, total, page, limit });
  } catch (err) { next(err); }
}

/**
 * GET /admin/submissions/:id
 * Detail view for a single submission including matched fraud record info and review history.
 */
async function getSubmissionDetail(req, res, next) {
  try {
    const { id } = req.params;

    const subRes = await pool.query(
      `SELECT ns.*, u.name AS user_name, u.email AS user_email, u.phone_number,
              kd.extracted_name AS fraud_match_name,
              kd.pan_number     AS fraud_match_pan,
              kd.aadhaar_number AS fraud_match_aadhaar
       FROM new_submissions ns
       JOIN users u ON ns.user_id = u.id
       LEFT JOIN kyc_documents kd ON ns.matched_fraud_id = kd.id
       WHERE ns.id = $1`,
      [id]
    );
    if (!subRes.rows.length) return res.status(404).json({ error: 'Submission not found' });

    const reviewRes = await pool.query(
      `SELECT r.*, u.name AS admin_name
       FROM new_submission_reviews r
       JOIN users u ON r.admin_id = u.id
       WHERE r.submission_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );

    res.json({ data: { ...subRes.rows[0], reviews: reviewRes.rows } });
  } catch (err) { next(err); }
}

/**
 * POST /admin/submissions/:id/action
 * Standard review actions: approved | rejected | reapply
 */
async function takeAction(req, res, next) {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;
    const adminId = req.user.userId;

    const allowed = ['approved', 'rejected', 'reapply'];
    if (!allowed.includes(action)) {
      return res.status(400).json({ error: `Invalid action. Allowed: ${allowed.join(', ')}` });
    }

    await pool.query(
      `UPDATE new_submissions SET status = $1, updated_at = NOW() WHERE id = $2`,
      [action, id]
    );
    await pool.query(
      `INSERT INTO new_submission_reviews (submission_id, admin_id, action, reason)
       VALUES ($1, $2, $3, $4)`,
      [id, adminId, action, reason || null]
    );

    res.json({ message: `Submission ${action} successfully` });
  } catch (err) { next(err); }
}

/**
 * POST /admin/submissions/:id/add-to-fraud-db
 * Admin confirms HIGH RISK → move document to fraud database.
 */
async function confirmAddToFraudDb(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const check = await pool.query(
      `SELECT risk_category, fraud_db_added FROM new_submissions WHERE id = $1`, [id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Submission not found' });
    if (check.rows[0].fraud_db_added) {
      return res.status(409).json({ error: 'Already added to fraud DB' });
    }

    const result = await addToFraudDb(id, adminId);
    res.json({ message: 'Added to fraud database', fraud_kyc_id: result.fraud_kyc_id });
  } catch (err) { next(err); }
}

/**
 * POST /admin/submissions/:id/decline-fraud-db
 * Admin says NO to HIGH RISK → keep in staging for manual review.
 */
async function declineFraudDb(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    await pool.query(
      `UPDATE new_submissions SET status = 'pending_review', updated_at = NOW() WHERE id = $1`, [id]
    );
    await pool.query(
      `INSERT INTO new_submission_reviews (submission_id, admin_id, action, reason)
       VALUES ($1, $2, 'keep_in_staging', 'Admin declined fraud DB addition')`,
      [id, adminId]
    );

    res.json({ message: 'Document kept in staging for manual review' });
  } catch (err) { next(err); }
}

module.exports = {
  listSubmissions,
  getSubmissionDetail,
  takeAction,
  confirmAddToFraudDb,
  declineFraudDb,
};
