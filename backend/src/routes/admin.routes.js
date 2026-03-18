const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const {
  listKyc,
  getKycDetail,
  takeAction,
  actionValidation,
} = require('../controllers/admin.controller');

// All admin routes require authentication + admin role
router.use(auth);
router.use(adminAuth);

// GET /admin/kyc — Paginated list of all KYC submissions
router.get('/kyc', listKyc);

// GET /admin/kyc/:id — Single KYC document detail with reviews
router.get('/kyc/:id', getKycDetail);

// POST /admin/kyc/:id/action — Admin decision (approve/reject/reupload)
router.post('/kyc/:id/action', actionValidation, takeAction);

module.exports = router;
