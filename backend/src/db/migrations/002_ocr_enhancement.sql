-- backend/src/db/migrations/002_ocr_enhancement.sql

-- Add Aadhaar number column if it doesn't exist
ALTER TABLE kyc_documents 
  ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(20);

-- Document type already exists in 001_init.sql, but ensuring it's there
-- ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50);

-- Add indexes for deduplication and faster lookups
CREATE INDEX IF NOT EXISTS idx_kyc_pan ON kyc_documents (pan_number) WHERE pan_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kyc_aadhaar ON kyc_documents (aadhaar_number) WHERE aadhaar_number IS NOT NULL;
