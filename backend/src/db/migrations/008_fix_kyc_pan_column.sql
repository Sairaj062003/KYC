-- backend/src/db/migrations/008_fix_kyc_pan_column.sql

ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50);
-- This was missing from the base 001_init.sql in some states
