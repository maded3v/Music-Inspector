-- Migration 007: Add review moderation system
-- Date: 2025-12-18

-- Add status column to reviews table (pending, approved, rejected)
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add moderation tracking columns
ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- Create index on status for fast filtering
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

-- Update existing reviews to be approved (backward compatibility)
UPDATE reviews SET status = 'approved' WHERE status IS NULL;

-- Set default for new reviews based on user role (will be handled in application code)
-- For now, default to 'approved' for backward compatibility
ALTER TABLE reviews ALTER COLUMN status SET DEFAULT 'approved';









