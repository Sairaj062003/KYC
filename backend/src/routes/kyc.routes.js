const router = require('express').Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const kycController = require('../controllers/kyc.controller');

// All KYC routes require authentication
router.use(auth);

// POST /kyc/upload — Upload a KYC document (single file field: 'document')
router.post('/upload', upload.single('document'), kycController.upload);

// GET /kyc/status/:id — Poll processing status of a specific document
router.get('/status/:id', kycController.getStatus);

// GET /kyc/my — List all documents submitted by the authenticated user
router.get('/my', kycController.getMyDocuments);

module.exports = router;
