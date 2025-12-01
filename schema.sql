-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tracks table
CREATE TABLE tracks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('single', 'album', 'ep')),
  cover VARCHAR(500),
  link VARCHAR(500),
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reviews table
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  score1 INTEGER NOT NULL CHECK (score1 >= 1 AND score1 <= 10),
  score2 INTEGER NOT NULL CHECK (score2 >= 1 AND score2 <= 10),
  score3 INTEGER NOT NULL CHECK (score3 >= 1 AND score3 <= 10),
  score4 INTEGER NOT NULL CHECK (score4 >= 1 AND score4 <= 10),
  score5 INTEGER NOT NULL CHECK (score5 >= 1 AND score5 <= 10),
  avg_score DECIMAL(3,1) NOT NULL,
  is_ai BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_tracks_created_at ON tracks(created_at DESC);
CREATE INDEX idx_reviews_track_id ON reviews(track_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);

-- Insert some sample data
INSERT INTO users (name, email, password) VALUES
('Admin', 'admin@musicinspector.com', '$2a$10$example.hash.here');

INSERT INTO tracks (title, artist, type, cover, link, user_id) VALUES
('Test Track', 'Test Artist', 'single', 'https://example.com/cover.jpg', 'https://example.com/track', 1),
('Another Track', 'Another Artist', 'album', 'https://example.com/cover2.jpg', 'https://example.com/track2', 1);
