-- Migration 009: Add release_date to tracks

ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS release_date DATE;

CREATE INDEX IF NOT EXISTS idx_tracks_release_date ON tracks(release_date DESC);
