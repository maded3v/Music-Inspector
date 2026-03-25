-- Migration 002: Create artists table
-- Date: 2025-12-18

CREATE TABLE IF NOT EXISTS artists (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  image_path VARCHAR(500),
  image_original_path VARCHAR(500),
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on name for fast lookups
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_artists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_artists_updated_at ON artists;
CREATE TRIGGER trigger_artists_updated_at
  BEFORE UPDATE ON artists
  FOR EACH ROW
  EXECUTE FUNCTION update_artists_updated_at();











