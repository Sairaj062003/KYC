require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth.routes');
const kycRoutes = require('./routes/kyc.routes');
const adminRoutes = require('./routes/admin.routes');
const filesRoutes = require('./routes/files.routes');
const submissionRoutes = require('./routes/newSubmission.routes');

// Import and run DB initialization
const initDb = require('./db/initDb');
initDb();

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

// ── Security Middleware ──────────────────────────────────────
app.use(helmet());

// CORS: allow frontend origin only (configurable via env)
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// ── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Ensure Upload Directory Exists ───────────────────────────
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[Server] Created upload directory: ${uploadDir}`);
}

// ── Health Check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ───────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/kyc', kycRoutes);
app.use('/admin', adminRoutes);
app.use('/admin/submissions', submissionRoutes);
app.use('/files', filesRoutes);

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Global Error Handler (must be last) ──────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║  KYC AI Verification System — Backend API         ║
  ║  Flairminds Software Pvt. Ltd.                    ║
  ║  Running on port ${PORT}                             ║
  ║  Environment: ${process.env.NODE_ENV || 'development'}                    ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;
