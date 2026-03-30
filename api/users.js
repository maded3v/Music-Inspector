const { query } = require('./db');
const { requireAuth } = require('./middleware');
const { columnExists } = require('./utils/dbHelpers');

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

/**
 * Get public user profile (no auth required)
 */
exports.getPublicUserProfile = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const hasIsBanned = await columnExists('users', 'is_banned');
    const userResult = await query(
      `SELECT
        id,
        name,
        avatar,
        created_at,
        ${hasIsBanned ? 'COALESCE(is_banned, FALSE)' : 'FALSE'} AS is_banned
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].is_banned) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const hasReviewStatus = await columnExists('reviews', 'status');
    const reviewsResult = await query(
      `SELECT
        r.id,
        r.track_id,
        r.text,
        r.avg_score,
        r.created_at,
        r.status,
        r.score1,
        r.score2,
        r.score3,
        r.score4,
        r.score5,
        t.title AS track_title,
        t.artist AS track_artist,
        t.cover AS track_cover
       FROM reviews r
       JOIN tracks t ON t.id = r.track_id
       WHERE r.user_id = $1
         AND t.status = 'approved'
         ${hasReviewStatus ? "AND (r.status = 'approved' OR r.status IS NULL)" : ''}
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [userId]
    );

    const reviews = reviewsResult.rows || [];
    const reviewCount = reviews.length;

    let favoriteArtist = null;
    if (reviewCount > 0) {
      const countByArtist = new Map();
      for (const review of reviews) {
        const artistName = review.track_artist || '';
        if (!artistName) continue;
        countByArtist.set(artistName, (countByArtist.get(artistName) || 0) + 1);
      }

      const sortedArtists = Array.from(countByArtist.entries()).sort((a, b) => b[1] - a[1]);
      if (sortedArtists.length === 1) {
        favoriteArtist = sortedArtists[0][0];
      } else if (sortedArtists.length > 1) {
        favoriteArtist = sortedArtists[0][1] > sortedArtists[1][1]
          ? sortedArtists[0][0]
          : 'Несколько исполнителей';
      }
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        created_at: user.created_at
      },
      stats: {
        registrationDate: user.created_at,
        reviewCount,
        favoriteArtist
      },
      reviews
    });
  } catch (error) {
    console.error('Error fetching public user profile:', error);
    return res.status(500).json({
      error: 'Server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update current user's display name
 */
exports.updateCurrentUserName = [
  requireAuth,
  async (req, res) => {
    const nextName = req.body?.name?.trim();

    if (!nextName || nextName.length < 2 || nextName.length > 80) {
      return res.status(400).json({ error: 'Name must be between 2 and 80 characters' });
    }

    try {
      const result = await query(
        `UPDATE users
         SET name = $1
         WHERE id = $2
         RETURNING id, name, email, role, avatar`,
        [nextName, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      console.error('Error updating current user name:', error);
      res.status(500).json({
        error: 'Server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
];
