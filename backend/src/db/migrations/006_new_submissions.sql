-- backend/src/db/migrations/006_new_submissions.sql
-- Dual-Database Architecture: Staging area for all new uploads

CREATE TABLE IF NOT EXISTS new_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path           VARCHAR(500) NOT NULL,
  original_name       VARCHAR(255),
  document_type       VARCHAR(50),
  extracted_name      VARCHAR(255),
  pan_number          VARCHAR(50),
  aadhaar_number      VARCHAR(50),
  dob                 DATE,
  ocr_raw_text        TEXT,
  risk_category       VARCHAR(20) NOT NULL DEFAULT 'NO_RISK',
  -- values: FRAUD | HIGH | MEDIUM | LOW | NO_RISK
  matched_fraud_id    UUID REFERENCES kyc_documents(id),
  -- which fraud record triggered the risk flag (null if NO_RISK)
  matched_fields      TEXT,
  -- JSON string: which fields matched e.g. '["pan_number","name"]'
  status              VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  -- pending_review | approved | rejected | reapply | added_to_fraud_db
  fraud_db_added      BOOLEAN NOT NULL DEFAULT false,
  -- true only if admin confirmed HIGH RISK -> add to fraud DB
  uploaded_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ns_user_id       ON new_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_ns_risk_category ON new_submissions(risk_category);
CREATE INDEX IF NOT EXISTS idx_ns_status        ON new_submissions(status);
CREATE INDEX IF NOT EXISTS idx_ns_pan           ON new_submissions(pan_number) WHERE pan_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ns_aadhaar       ON new_submissions(aadhaar_number) WHERE aadhaar_number IS NOT NULL;

-- Admin review log for new_submissions (separate from kyc_reviews which tracks fraud DB)
CREATE TABLE IF NOT EXISTS new_submission_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES new_submissions(id) ON DELETE CASCADE,
  admin_id      UUID NOT NULL REFERENCES users(id),
  action        VARCHAR(50) NOT NULL,
  -- approved | rejected | reapply | add_to_fraud_db | keep_in_staging
  reason        TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nsr_submission ON new_submission_reviews(submission_id);
