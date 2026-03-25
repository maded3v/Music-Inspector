-- Migration 003: Add moderation status and artist linking to tracks table
-- Date: 2025-12-18

-- Create status enum type
DO $$ BEGIN
    CREATE TYPE track_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status column with default 'approved' for existing tracks (backward compatibility)
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS status track_status DEFAULT 'approved' NOT NULL;

-- Add artist_id foreign key (nullable for backward compatibility)
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS artist_id INTEGER REFERENCES artists(id) ON DELETE SET NULL;

-- Add moderation fields
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for moderation queries
CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_approved_at ON tracks(approved_at DESC);

-- Set approved_at for existing approved tracks
UPDATE tracks 
SET approved_at = created_at 
WHERE status = 'approved' AND approved_at IS NULL;











