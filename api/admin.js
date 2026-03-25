const { query } = require('./db');
const { requireAdmin } = require('./middleware');
const { columnExists } = require('./utils/dbHelpers');

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

      // Reject track
      const result = await query(
        `UPDATE tracks 
         SET status = 'rejected', rejected_reason = $1
         WHERE id = $2
         RETURNING *`,
        [reason.trim(), trackId]
      );

      res.json({ success: true, track: result.rows[0] });
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

      // Reject review
      const result = await query(
        `UPDATE reviews 
         SET status = 'rejected', rejected_reason = $1
         WHERE id = $2
         RETURNING *`,
        [reason.trim(), reviewId]
      );

      res.json({ success: true, review: result.rows[0] });
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



