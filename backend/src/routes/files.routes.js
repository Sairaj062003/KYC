const router = require('express').Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Allowed extensions for security
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf'];

// MIME type map
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

/**
 * GET /files/:filename
 * Securely serves uploaded files. Admin-only access.
 * Validates filename to prevent directory traversal.
 */
router.get('/:filename', auth, adminAuth, (req, res) => {
  const { filename } = req.params;

  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return res.status(400).json({ error: 'File type not allowed' });
  }

  const filePath = path.resolve(UPLOAD_DIR, filename);

  // Ensure the resolved path is still within the upload directory
  const resolvedUploadDir = path.resolve(UPLOAD_DIR);
  if (!filePath.startsWith(resolvedUploadDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', (err) => {
    console.error('[Files] Stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to read file' });
    }
  });
});

module.exports = router;
