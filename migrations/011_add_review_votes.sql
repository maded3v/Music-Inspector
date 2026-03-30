-- Migration 011: Add review votes (likes/dislikes)
-- Date: 2026-03-31

CREATE TABLE IF NOT EXISTS review_votes (
  id BIGSERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_id ON review_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review_vote ON review_votes(review_id, vote);

CREATE OR REPLACE FUNCTION set_review_votes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_votes_updated_at ON review_votes;
CREATE TRIGGER trg_review_votes_updated_at
BEFORE UPDATE ON review_votes
FOR EACH ROW
EXECUTE FUNCTION set_review_votes_updated_at();

