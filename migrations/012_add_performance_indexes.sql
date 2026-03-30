-- Migration 012: Add performance indexes for hot endpoints
-- Date: 2026-03-31

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracks' AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tracks_status_created_at ON tracks(status, created_at DESC)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracks' AND column_name = 'status'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracks' AND column_name = 'type'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tracks_status_type_created_at ON tracks(status, type, created_at DESC)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'status'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_track_status_created_at ON reviews(track_id, status, created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reviews_status_created_at ON reviews(status, created_at DESC)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reviews_user_track_created_at
  ON reviews(user_id, track_id, created_at DESC);
