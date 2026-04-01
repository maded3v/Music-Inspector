const { query } = require('./db');
const { requireAdmin } = require('./middleware');
const { columnExists } = require('./utils/dbHelpers');

function parseReleaseDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('release_date must be in YYYY-MM-DD format');
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('Invalid release_date');
  }

  return value;
}

async function getBanColumnsState() {
  const [isBannedExists, bannedAtExists, bannedReasonExists] = await Promise.all([
    columnExists('users', 'is_banned'),
    columnExists('users', 'banned_at'),
    columnExists('users', 'banned_reason')
  ]);

  return { isBannedExists, bannedAtExists, bannedReasonExists };
}

function parseUserId(rawId) {
  const userId = parseInt(rawId, 10);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

/**
 * Get moderation queue - pending releases
 */
exports.getModerationQueue = [
  requireAdmin,
  async (req, res) => {
    try {
      const result = await query(
        `SELECT t.*, u.name as submitter_name, u.email as submitter_email
         FROM tracks t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.status = 'pending'
         ORDER BY t.created_at ASC`
      );
      res.json({ tracks: result.rows || [] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'getModerationQueue');
    }
  }
];

/**
 * Approve a release
 */
exports.approveRelease = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const adminId = req.user.id;

    try {
      // Validate ID
      const trackId = parseInt(id);
      if (isNaN(trackId) || trackId <= 0) {
        return res.status(400).json({ error: 'Invalid track ID' });
      }

      // Check if track exists and is pending
      const trackCheck = await query('SELECT id, status FROM tracks WHERE id = $1', [trackId]);
      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Track not found' });
      }

      if (trackCheck.rows[0].status !== 'pending') {
        return res.status(400).json({ error: 'Track is not pending approval' });
      }

      // Approve track
      const result = await query(
        `UPDATE tracks 
         SET status = 'approved', approved_at = NOW(), approved_by = $1
         WHERE id = $2
         RETURNING *`,
        [adminId, trackId]
      );

      res.json({ success: true, track: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'approveRelease');
    }
  }
];

/**
 * Reject a release
 */
exports.rejectRelease = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    if (reason.trim().length > 500) {
      return res.status(400).json({ error: 'Rejection reason must not exceed 500 characters' });
    }

    try {
      // Validate ID
      const trackId = parseInt(id);
      if (isNaN(trackId) || trackId <= 0) {
        return res.status(400).json({ error: 'Invalid track ID' });
      }

      // Check if track exists and is pending
      const trackCheck = await query('SELECT id, status FROM tracks WHERE id = $1', [trackId]);
      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Track not found' });
      }

      if (trackCheck.rows[0].status !== 'pending') {
        return res.status(400).json({ error: 'Track is not pending approval' });
      }

      // On rejection, hard-delete release and related user-submitted data
      // Reviews are removed automatically via ON DELETE CASCADE
      const result = await query(
        `DELETE FROM tracks WHERE id = $1 RETURNING id, title, artist`,
        [trackId]
      );

      res.json({
        success: true,
        message: 'Release rejected and removed',
        release: {
          id: result.rows[0].id,
          title: result.rows[0].title,
          artist: result.rows[0].artist,
          rejectionReason: reason.trim()
        }
      });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'rejectRelease');
    }
  }
];

/**
 * Get all tracks (admin only) - includes all statuses
 */
exports.getAllTracks = [
  requireAdmin,
  async (req, res) => {
    const { status, limit = 50, offset = 0 } = req.query;

    try {
      // Validate and sanitize pagination parameters
      const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100); // Max 100
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      let queryText = `SELECT t.*, u.name as creator_name 
                       FROM tracks t 
                       LEFT JOIN users u ON t.user_id = u.id`;
      const params = [];
      let paramIndex = 1;

      if (status) {
        // Validate status value
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: 'Invalid status value' });
        }
        queryText += ` WHERE t.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      queryText += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parsedLimit, parsedOffset);

      const result = await query(queryText, params);
      res.json({ tracks: result.rows || [] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'getAllTracks');
    }
  }
];

/**
 * Get review moderation queue - pending reviews
 */
exports.getReviewModerationQueue = [
  requireAdmin,
  async (req, res) => {
    try {
      // Check if status column exists
      const statusColumnExists = await columnExists('reviews', 'status');
      
      if (!statusColumnExists) {
        // If status column doesn't exist, return empty queue
        return res.json({ reviews: [] });
      }
      
      const result = await query(
        `SELECT r.*, t.title as track_title, t.artist as track_artist, t.cover as track_cover, u.name as author_name, u.email as author_email
         FROM reviews r
         JOIN tracks t ON r.track_id = t.id
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.status = 'pending'
         ORDER BY r.created_at ASC`
      );
      res.json({ reviews: result.rows || [] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'getReviewModerationQueue');
    }
  }
];

/**
 * Approve a review
 */
exports.approveReview = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const adminId = req.user.id;

    try {
      // Validate ID
      const reviewId = parseInt(id);
      if (isNaN(reviewId) || reviewId <= 0) {
        return res.status(400).json({ error: 'Invalid review ID' });
      }

      // Check if status column exists
      const statusColumnExists = await columnExists('reviews', 'status');
      
      if (!statusColumnExists) {
        return res.status(400).json({ error: 'Review moderation system not available. Please run migration 007.' });
      }

      // Check if review exists and is pending
      const reviewCheck = await query('SELECT id, status FROM reviews WHERE id = $1', [reviewId]);
      if (reviewCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (reviewCheck.rows[0].status !== 'pending') {
        return res.status(400).json({ error: 'Review is not pending approval' });
      }

      // Approve review
      const result = await query(
        `UPDATE reviews 
         SET status = 'approved', approved_at = NOW(), approved_by = $1
         WHERE id = $2
         RETURNING *`,
        [adminId, reviewId]
      );

      res.json({ success: true, review: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'approveReview');
    }
  }
];

/**
 * Reject a review
 */
exports.rejectReview = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    if (reason.trim().length > 500) {
      return res.status(400).json({ error: 'Rejection reason must not exceed 500 characters' });
    }

    try {
      // Validate ID
      const reviewId = parseInt(id);
      if (isNaN(reviewId) || reviewId <= 0) {
        return res.status(400).json({ error: 'Invalid review ID' });
      }

      // Check if status column exists
      const statusColumnExists = await columnExists('reviews', 'status');
      
      if (!statusColumnExists) {
        return res.status(400).json({ error: 'Review moderation system not available. Please run migration 007.' });
      }

      // Check if review exists and is pending
      const reviewCheck = await query('SELECT id, status FROM reviews WHERE id = $1', [reviewId]);
      if (reviewCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (reviewCheck.rows[0].status !== 'pending') {
        return res.status(400).json({ error: 'Review is not pending approval' });
      }

      // On rejection, hard-delete the review to prevent moderation spam buildup
      const result = await query(
        `DELETE FROM reviews WHERE id = $1 RETURNING id, track_id, user_id`,
        [reviewId]
      );

      res.json({
        success: true,
        message: 'Review rejected and removed',
        review: {
          id: result.rows[0].id,
          track_id: result.rows[0].track_id,
          user_id: result.rows[0].user_id,
          rejectionReason: reason.trim()
        }
      });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'rejectReview');
    }
  }
];

/**
 * Delete a release (admin only)
 */
exports.deleteRelease = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;

    try {
      const trackId = parseInt(id);
      if (isNaN(trackId) || trackId <= 0) {
        return res.status(400).json({ error: 'Invalid track ID' });
      }

      // Check if track exists
      const trackCheck = await query('SELECT id FROM tracks WHERE id = $1', [trackId]);
      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Track not found' });
      }

      // Delete the track (reviews will cascade delete due to foreign key)
      await query('DELETE FROM tracks WHERE id = $1', [trackId]);

      res.json({ success: true, message: 'Release deleted successfully' });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'deleteRelease');
    }
  }
];

/**
 * Delete a review (admin only)
 */
exports.deleteReview = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;

    try {
      const reviewId = parseInt(id);
      if (isNaN(reviewId) || reviewId <= 0) {
        return res.status(400).json({ error: 'Invalid review ID' });
      }

      // Check if review exists
      const reviewCheck = await query('SELECT id FROM reviews WHERE id = $1', [reviewId]);
      if (reviewCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }

      // Delete the review
      await query('DELETE FROM reviews WHERE id = $1', [reviewId]);

      res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'deleteReview');
    }
  }
];

/**
 * Update release fields (admin only)
 */
exports.updateRelease = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { title, artist, type, link, release_date, cover } = req.body;

    try {
      const trackId = parseInt(id);
      if (isNaN(trackId) || trackId <= 0) {
        return res.status(400).json({ error: 'Invalid track ID' });
      }

      const sanitizedTitle = typeof title === 'string' ? title.trim() : '';
      const sanitizedArtist = typeof artist === 'string' ? artist.trim() : '';
      const sanitizedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
      const sanitizedLink = typeof link === 'string' && link.trim() ? link.trim() : null;
      const sanitizedCover = typeof cover === 'string' && cover.trim() ? cover.trim() : null;

      if (!sanitizedTitle) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!sanitizedArtist) {
        return res.status(400).json({ error: 'Artist is required' });
      }

      if (!['single', 'album', 'ep'].includes(sanitizedType)) {
        return res.status(400).json({ error: 'Type must be single, album, or ep' });
      }

      let normalizedReleaseDate = null;
      try {
        normalizedReleaseDate = parseReleaseDate(release_date);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const trackCheck = await query('SELECT id FROM tracks WHERE id = $1', [trackId]);
      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Track not found' });
      }

      const hasReleaseDateColumn = await columnExists('tracks', 'release_date');

      let result;
      if (hasReleaseDateColumn) {
        result = await query(
          `UPDATE tracks
           SET title = $1,
               artist = $2,
               type = $3,
               link = $4,
               cover = $5,
               release_date = $6
           WHERE id = $7
           RETURNING *`,
          [sanitizedTitle, sanitizedArtist, sanitizedType, sanitizedLink, sanitizedCover, normalizedReleaseDate, trackId]
        );
      } else {
        result = await query(
          `UPDATE tracks
           SET title = $1,
               artist = $2,
               type = $3,
               link = $4,
               cover = $5
           WHERE id = $6
           RETURNING *`,
          [sanitizedTitle, sanitizedArtist, sanitizedType, sanitizedLink, sanitizedCover, trackId]
        );
      }

      res.json({ success: true, track: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'updateRelease');
    }
  }
];

/**
 * Promote user to admin by email
 */
exports.promoteToAdmin = [
  requireAdmin,
  async (req, res) => {
    const { email } = req.body;

    if (!email || email.trim().length === 0) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      // Find user by email
      const userCheck = await query('SELECT id, email, role FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found with this email' });
      }

      const user = userCheck.rows[0];
      
      if (user.role === 'admin') {
        return res.status(400).json({ error: 'User is already an admin' });
      }

      // Promote to admin
      const result = await query(
        `UPDATE users SET role = 'admin' WHERE id = $1 RETURNING id, email, name, role`,
        [user.id]
      );

      res.json({ success: true, user: result.rows[0], message: `User ${email} has been promoted to admin` });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'promoteToAdmin');
    }
  }
];

/**
 * Get all users (admin only)
 */
exports.getAllUsers = [
  requireAdmin,
  async (req, res) => {
    try {
      const { isBannedExists, bannedAtExists, bannedReasonExists } = await getBanColumnsState();

      const result = await query(
        `SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.avatar,
          u.created_at,
          ${isBannedExists ? 'COALESCE(u.is_banned, FALSE)' : 'FALSE'} AS is_banned,
          ${bannedAtExists ? 'u.banned_at' : 'NULL'} AS banned_at,
          ${bannedReasonExists ? 'u.banned_reason' : 'NULL'} AS banned_reason,
          COUNT(DISTINCT r.id)::INT AS review_count,
          COUNT(DISTINCT t.id)::INT AS release_count
         FROM users u
         LEFT JOIN reviews r ON r.user_id = u.id
         LEFT JOIN tracks t ON t.user_id = u.id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      );

      return res.json({ users: result.rows || [] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'getAllUsers');
    }
  }
];

/**
 * Update user name (admin only)
 */
exports.updateUserName = [
  requireAdmin,
  async (req, res) => {
    const userId = parseUserId(req.params.id);
    const newName = req.body?.name?.trim();

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!newName || newName.length < 2 || newName.length > 80) {
      return res.status(400).json({ error: 'Name must be between 2 and 80 characters' });
    }

    try {
      const result = await query(
        `UPDATE users
         SET name = $1
         WHERE id = $2
         RETURNING id, name, email, role, avatar`,
        [newName, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'updateUserName');
    }
  }
];

/**
 * Remove user avatar (admin only)
 */
exports.removeUserAvatar = [
  requireAdmin,
  async (req, res) => {
    const userId = parseUserId(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
      const result = await query(
        `UPDATE users
         SET avatar = NULL
         WHERE id = $1
         RETURNING id, name, email, role, avatar`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'removeUserAvatar');
    }
  }
];

/**
 * Update user avatar path/url (admin only)
 */
exports.updateUserAvatar = [
  requireAdmin,
  async (req, res) => {
    const userId = parseUserId(req.params.id);
    const avatar = req.body && typeof req.body.avatar === 'string' ? req.body.avatar.trim() : '';

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!avatar) {
      return res.status(400).json({ error: 'Avatar URL/path is required' });
    }

    if (avatar.length > 1000) {
      return res.status(400).json({ error: 'Avatar URL/path is too long' });
    }

    try {
      const result = await query(
        `UPDATE users
         SET avatar = $1
         WHERE id = $2
         RETURNING id, name, email, role, avatar`,
        [avatar, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'updateUserAvatar');
    }
  }
];

/**
 * Ban user (admin only)
 */
exports.banUser = [
  requireAdmin,
  async (req, res) => {
    const userId = parseUserId(req.params.id);
    const reason = req.body?.reason?.trim() || null;

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot ban your own account' });
    }

    if (reason && reason.length > 500) {
      return res.status(400).json({ error: 'Ban reason must not exceed 500 characters' });
    }

    try {
      const { isBannedExists, bannedAtExists, bannedReasonExists } = await getBanColumnsState();
      if (!isBannedExists || !bannedAtExists || !bannedReasonExists) {
        return res.status(400).json({
          error: 'Ban system is not available. Please run migration 010.'
        });
      }

      const target = await query('SELECT id, role FROM users WHERE id = $1', [userId]);
      if (target.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (target.rows[0].role === 'admin') {
        return res.status(400).json({ error: 'Cannot ban another admin account' });
      }

      const result = await query(
        `UPDATE users
         SET is_banned = TRUE,
             banned_at = NOW(),
             banned_reason = $1
         WHERE id = $2
         RETURNING id, name, email, role, avatar, is_banned, banned_at, banned_reason`,
        [reason, userId]
      );

      return res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'banUser');
    }
  }
];

/**
 * Unban user (admin only)
 */
exports.unbanUser = [
  requireAdmin,
  async (req, res) => {
    const userId = parseUserId(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
      const { isBannedExists, bannedAtExists, bannedReasonExists } = await getBanColumnsState();
      if (!isBannedExists || !bannedAtExists || !bannedReasonExists) {
        return res.status(400).json({
          error: 'Ban system is not available. Please run migration 010.'
        });
      }

      const result = await query(
        `UPDATE users
         SET is_banned = FALSE,
             banned_at = NULL,
             banned_reason = NULL
         WHERE id = $1
         RETURNING id, name, email, role, avatar, is_banned, banned_at, banned_reason`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ success: true, user: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'unbanUser');
    }
  }
];
