-- backend/src/db/migrations/007_add_similarity_score.sql

ALTER TABLE new_submissions ADD COLUMN IF NOT EXISTS similarity_score FLOAT DEFAULT 0.0;
