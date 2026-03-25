const { validationResult, body } = require('express-validator');
const pool = require('../config/db');

/**
 * GET /admin/kyc
 * Paginated list of all KYC documents with user email.
 * Query params: page (default 1), limit (default 20), status (optional filter)
 */
async function listKyc(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status || null;
    const riskFilter = req.query.risk || null; // 'HIGH' | 'MEDIUM' | 'LOW'

    // Build query with optional status and risk filters
    let whereClause = '';
    const params = [];

    if (statusFilter) {
      whereClause = 'WHERE kd.status = $1';
      params.push(statusFilter);
    }
    if (riskFilter) {
      const paramIndex = params.length + 1;
      whereClause += (whereClause ? ' AND' : 'WHERE') + ` kd.similarity_category = $${paramIndex}`;
      params.push(riskFilter);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM kyc_documents kd
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated data with user email
    const dataQuery = `
      SELECT kd.id, kd.user_id, u.email AS user_email, kd.original_name,
             kd.document_type, kd.extracted_name, kd.pan_number, kd.aadhaar_number, kd.dob,
             kd.status, kd.similarity_score, kd.similarity_category, kd.is_duplicate,
             kd.uploaded_at, kd.updated_at
      FROM kyc_documents kd
      JOIN users u ON kd.user_id = u.id
      ${whereClause}
      ORDER BY kd.uploaded_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const dataResult = await pool.query(dataQuery, params);

    res.status(200).json({
      data: dataResult.rows,
      total,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /admin/kyc/:id
 * Single KYC document detail with submitter info and review history.
 */
async function getKycDetail(req, res, next) {
  try {
    const { id } = req.params;

    // Fetch KYC document with user info
    const kycResult = await pool.query(
      `SELECT kd.*, kd.file_path, u.name AS user_name, u.email AS user_email,
              u.phone_number AS user_phone
       FROM kyc_documents kd
       JOIN users u ON kd.user_id = u.id
       WHERE kd.id = $1`,
      [id]
    );

    if (kycResult.rows.length === 0) {
      return res.status(404).json({ error: 'KYC document not found' });
    }

    // Fetch review history
    const reviewsResult = await pool.query(
      `SELECT kr.id, kr.action, kr.reason, kr.created_at,
              u.name AS admin_name, u.email AS admin_email
       FROM kyc_reviews kr
       JOIN users u ON kr.admin_id = u.id
       WHERE kr.kyc_id = $1
       ORDER BY kr.created_at DESC`,
      [id]
    );

    res.status(200).json({
      data: {
        ...kycResult.rows[0],
        reviews: reviewsResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Validation rules for admin action.
 */
const actionValidation = [
  body('action')
    .isIn(['approved', 'rejected', 'reupload_requested'])
    .withMessage('Action must be one of: approved, rejected, reupload_requested'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string'),
];

/**
 * POST /admin/kyc/:id/action
 * Admin decision on a KYC submission: approve, reject, or request re-upload.
 */
async function takeAction(req, res, next) {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { action, reason } = req.body;
    const adminId = req.user.userId;

    // Verify the KYC document exists
    const kycCheck = await pool.query(
      'SELECT id, status FROM kyc_documents WHERE id = $1',
      [id]
    );
    if (kycCheck.rows.length === 0) {
      return res.status(404).json({ error: 'KYC document not found' });
    }

    // Update KYC document status
    await pool.query(
      `UPDATE kyc_documents
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [action, id]
    );

    // Insert review record
    await pool.query(
      `INSERT INTO kyc_reviews (kyc_id, admin_id, action, reason)
       VALUES ($1, $2, $3, $4)`,
      [id, adminId, action, reason || null]
    );

    // Fetch updated record to return
    const updatedResult = await pool.query(
      `SELECT kd.*, u.email AS user_email
       FROM kyc_documents kd
       JOIN users u ON kd.user_id = u.id
       WHERE kd.id = $1`,
      [id]
    );

    res.status(200).json({
      message: `KYC document ${action} successfully`,
      data: updatedResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listKyc,
  getKycDetail,
  takeAction,
  actionValidation,
};
