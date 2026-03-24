-- Migration: Add similarity_category to kyc_documents

ALTER TABLE kyc_documents
ADD COLUMN IF NOT EXISTS similarity_category VARCHAR(20);

-- Update existing records if any
UPDATE kyc_documents
SET similarity_category = CASE
  WHEN similarity_score >= 0.85 THEN 'HIGH'
  WHEN similarity_score >= 0.60 THEN 'MEDIUM'
  ELSE 'LOW'
END
WHERE similarity_score IS NOT NULL;
