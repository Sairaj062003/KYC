// backend/src/routes/newSubmission.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const ctrl = require('../controllers/newSubmission.controller');

// All submission routes require admin authentication
router.use(auth, adminAuth);

// GET  /admin/submissions         — list all new submissions (filterable by risk/status)
router.get('/', ctrl.listSubmissions);

// GET  /admin/submissions/:id     — detail view for a single submission
router.get('/:id', ctrl.getSubmissionDetail);

// POST /admin/submissions/:id/action            — approve | reject | reapply
router.post('/:id/action', ctrl.takeAction);

// POST /admin/submissions/:id/add-to-fraud-db   — HIGH RISK confirmed → move to fraud DB
router.post('/:id/add-to-fraud-db', ctrl.confirmAddToFraudDb);

// POST /admin/submissions/:id/decline-fraud-db  — admin says no → keep in staging
router.post('/:id/decline-fraud-db', ctrl.declineFraudDb);

module.exports = router;
