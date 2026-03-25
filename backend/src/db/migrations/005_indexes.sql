-- Index for admin risk filter queries
CREATE INDEX IF NOT EXISTS idx_kyc_risk_category
  ON kyc_documents(similarity_category);

-- Index for duplicate flag queries
CREATE INDEX IF NOT EXISTS idx_kyc_duplicate
  ON kyc_documents(is_duplicate);
