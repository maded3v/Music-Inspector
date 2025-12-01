const { query } = require('./db');
const { authenticate } = require('./auth');

exports.addReview = [
  authenticate,
  async (req, res) => {
    const { trackId, text, score1, score2, score3, score4, score5 } = req.body;
    const userId = req.user.id;

    try {
      // Check if track exists
      const trackCheck = await query('SELECT id FROM tracks WHERE id = $1', [trackId]);
      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Track not found' });
      }

      // Calculate average score
      const avgScore = (score1 + score2 + score3 + score4 + score5) / 5;

      // Add review
      const result = await query(
        'INSERT INTO reviews (track_id, user_id, text, score1, score2, score3, score4, score5, avg_score) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [trackId, userId, text, score1, score2, score3, score4, score5, avgScore]
      );

      res.json({ success: true, review: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
];

exports.getReviewsByTrack = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      'SELECT r.*, u.name as author_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id WHERE r.track_id = $1 ORDER BY r.created_at DESC',
      [id]
    );

    res.json({ reviews: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getLatestReviews = async (req, res) => {
  try {
    const result = await query(
      'SELECT r.*, t.title as track_title, t.artist as track_artist, u.name as author_name FROM reviews r JOIN tracks t ON r.track_id = t.id LEFT JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 10'
    );

    res.json({ reviews: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.generateMIReview = [
  authenticate,
  async (req, res) => {
    const { trackId } = req.body;

    try {
      // Get track info
      const trackResult = await query('SELECT * FROM tracks WHERE id = $1', [trackId]);
      if (trackResult.rows.length === 0) {
        return res.status(404).json({ error: 'Track not found' });
      }

      const track = trackResult.rows[0];

      // Generate AI review (simplified template)
      const aiReview = {
        text: `Music Inspector AI Review: "${track.title}" от ${track.artist} представляет собой ${track.type === 'single' ? 'захватывающий сингл' : 'впечатляющий альбом'}, который демонстрирует высокий уровень мастерства в музыкальном искусстве. Композиция отличается оригинальным подходом к аранжировке и глубоким эмоциональным содержанием.`,
        score1: Math.floor(Math.random() * 3) + 7, // 7-9
        score2: Math.floor(Math.random() * 3) + 7,
        score3: Math.floor(Math.random() * 3) + 7,
        score4: Math.floor(Math.random() * 3) + 7,
        score5: Math.floor(Math.random() * 3) + 7
      };

      const avgScore = (aiReview.score1 + aiReview.score2 + aiReview.score3 + aiReview.score4 + aiReview.score5) / 5;

      // Add AI review
      const result = await query(
        'INSERT INTO reviews (track_id, user_id, text, score1, score2, score3, score4, score5, avg_score, is_ai) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [trackId, null, aiReview.text, aiReview.score1, aiReview.score2, aiReview.score3, aiReview.score4, aiReview.score5, avgScore, true]
      );

      res.json({ success: true, review: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
];
