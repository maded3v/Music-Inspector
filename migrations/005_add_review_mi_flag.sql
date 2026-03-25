-- Migration 005: Add MI badge flag to reviews table
-- Date: 2025-12-18

-- Add is_mi_review flag
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS is_mi_review BOOLEAN DEFAULT FALSE NOT NULL;

-- Create index for filtering MI reviews
CREATE INDEX IF NOT EXISTS idx_reviews_is_mi_review ON reviews(is_mi_review);











