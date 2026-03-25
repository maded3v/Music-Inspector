-- Migration 006: Create popular releases materialized view
-- Date: 2025-12-18

-- Create materialized view for popular releases
-- This view calculates review count in last 3 days per track
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_releases AS
SELECT 
  t.id AS track_id,
  COUNT(r.id) AS review_count_3d,
  AVG(r.avg_score) AS avg_score_3d,
  MAX(r.created_at) AS last_review_at,
  CURRENT_TIMESTAMP AS last_updated
FROM tracks t
LEFT JOIN reviews r ON r.track_id = t.id 
  AND r.created_at >= NOW() - INTERVAL '3 days'
WHERE t.status = 'approved'
GROUP BY t.id
HAVING COUNT(r.id) > 0
ORDER BY review_count_3d DESC, last_review_at DESC;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_popular_releases_count ON popular_releases(review_count_3d DESC);
CREATE INDEX IF NOT EXISTS idx_popular_releases_track_id ON popular_releases(track_id);

-- Create function to refresh popular releases
CREATE OR REPLACE FUNCTION refresh_popular_releases()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_releases;
END;
$$ LANGUAGE plpgsql;











