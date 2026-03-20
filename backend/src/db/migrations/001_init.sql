-- ============================================================
-- KYC AI Verification System — Database Schema
-- Flairminds Software Pvt. Ltd. | FM-KYC-SRS-001
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Users table
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20)  NOT NULL UNIQUE,
  role         VARCHAR(20)  NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- KYC Documents table
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path        VARCHAR(500) NOT NULL,
  original_name    VARCHAR(255),
  document_type    VARCHAR(50),            -- 'aadhaar' | 'pan' | 'passport'
  extracted_name   VARCHAR(255),
  pan_number       VARCHAR(50),
  dob              DATE,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending',
                   -- pending | processing | extracted | approved | rejected | reupload_requested | extraction_failed
  similarity_score FLOAT,
  is_duplicate     BOOLEAN NOT NULL DEFAULT false,
  ocr_raw_text     TEXT,
  uploaded_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- KYC Reviews table
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id     UUID NOT NULL REFERENCES kyc_documents(id) ON DELETE CASCADE,
  admin_id   UUID NOT NULL REFERENCES users(id),
  action     VARCHAR(50) NOT NULL,  -- 'approved' | 'rejected' | 'reupload_requested'
  reason     TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status  ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_reviews_kyc ON kyc_reviews(kyc_id);
