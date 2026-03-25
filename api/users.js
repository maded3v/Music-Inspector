const { query } = require('./db');
const { requireAuth } = require('./middleware');

/**
 * Get user statistics
 */
exports.getUserStats = [
  requireAuth,
  async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    try {
      // Users can only see their own stats, or all stats if admin
      if (parseInt(userId) !== currentUserId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get user info including created_at
      const userResult = await query(
        `SELECT id, name, email, created_at FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];

      // Get review count
      const reviewCountResult = await query(
        `SELECT COUNT(*) as count FROM reviews WHERE user_id = $1`,
        [userId]
      );
      const reviewCount = parseInt(reviewCountResult.rows[0].count) || 0;

      // Get favorite artist (most reviewed)
      const favoriteArtistResult = await query(
        `SELECT t.artist, COUNT(*) as review_count
         FROM reviews r
         JOIN tracks t ON r.track_id = t.id
         WHERE r.user_id = $1
         GROUP BY t.artist
         ORDER BY review_count DESC
         LIMIT 2`,
        [userId]
      );

      let favoriteArtist = null;
      if (favoriteArtistResult.rows.length === 0) {
        favoriteArtist = null;
      } else if (favoriteArtistResult.rows.length === 1) {
        favoriteArtist = favoriteArtistResult.rows[0].artist;
      } else {
        // Check if there's a clear leader
        const first = parseInt(favoriteArtistResult.rows[0].review_count);
        const second = parseInt(favoriteArtistResult.rows[1].review_count);
        if (first > second) {
          favoriteArtist = favoriteArtistResult.rows[0].artist;
        } else {
          favoriteArtist = 'Несколько исполнителей';
        }
      }

      res.json({
        stats: {
          registrationDate: user.created_at,
          reviewCount: reviewCount,
          favoriteArtist: favoriteArtist
        }
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ 
        error: 'Server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

/**
 * Get user's reviews
 */
exports.getUserReviews = [
  requireAuth,
  async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    try {
      // Users can only see their own reviews, or all reviews if admin
      if (parseInt(userId) !== currentUserId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await query(
        `SELECT r.*, t.title as track_title, t.artist as track_artist, t.cover as track_cover
         FROM reviews r
         JOIN tracks t ON r.track_id = t.id
         WHERE r.user_id = $1
         ORDER BY r.created_at DESC`,
        [userId]
      );

      res.json({ reviews: result.rows || [] });
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      res.status(500).json({ 
        error: 'Server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];

/**
 * Get user's releases
 */
exports.getUserReleases = [
  requireAuth,
  async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    try {
      // Users can only see their own releases, or all releases if admin
      if (parseInt(userId) !== currentUserId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await query(
        `SELECT t.*
         FROM tracks t
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC`,
        [userId]
      );

      res.json({ releases: result.rows || [] });
    } catch (error) {
      console.error('Error fetching user releases:', error);
      res.status(500).json({ 
        error: 'Server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];


