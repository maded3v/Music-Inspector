const { query } = require('./db');
const { requireAuth } = require('./middleware');
const { columnExists, tableExists } = require('./utils/dbHelpers');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function getOptionalUserId(req) {
  const token = req.cookies?.token;
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.id || null;
  } catch (error) {
    return null;
  }
}

function normalizeVote(rawVote) {
  if (rawVote === 1 || rawVote === '1' || rawVote === 'up' || rawVote === true) {
    return 1;
  }

  if (rawVote === -1 || rawVote === '-1' || rawVote === 'down') {
    return -1;
  }

  if (
    rawVote === 0 ||
    rawVote === '0' ||
    rawVote === null ||
    rawVote === undefined ||
    rawVote === false ||
    rawVote === 'none' ||
    rawVote === 'remove'
  ) {
    return 0;
  }

  return null;
}

function buildVoteSelectFields(votesEnabled, includeMyVote) {
  if (!votesEnabled) {
    return `
      , 0::int AS upvotes
      , 0::int AS downvotes
      , 0::int AS helpful_score
      , 0::int AS my_vote
    `;
  }

  return `
    , COALESCE(vs.upvotes, 0)::int AS upvotes
    , COALESCE(vs.downvotes, 0)::int AS downvotes
    , (COALESCE(vs.upvotes, 0) - COALESCE(vs.downvotes, 0))::int AS helpful_score
    , ${includeMyVote ? 'COALESCE(my_vote.vote, 0)::int' : '0::int'} AS my_vote
  `;
}

function buildVoteJoins(votesEnabled, includeMyVote, userIdParamRef) {
  if (!votesEnabled) {
    return '';
  }

  return `
    LEFT JOIN (
      SELECT
        review_id,
        COUNT(*) FILTER (WHERE vote = 1) AS upvotes,
        COUNT(*) FILTER (WHERE vote = -1) AS downvotes
      FROM review_votes
      GROUP BY review_id
    ) vs ON vs.review_id = r.id
    ${includeMyVote ? `LEFT JOIN review_votes my_vote ON my_vote.review_id = r.id AND my_vote.user_id = ${userIdParamRef}` : ''}
  `;
}

async function getReviewVoteSummary(reviewId) {
  const summaryResult = await query(
    `SELECT
      COALESCE(COUNT(*) FILTER (WHERE vote = 1), 0)::int AS upvotes,
      COALESCE(COUNT(*) FILTER (WHERE vote = -1), 0)::int AS downvotes
     FROM review_votes
     WHERE review_id = $1`,
    [reviewId]
  );

  const summary = summaryResult.rows[0] || { upvotes: 0, downvotes: 0 };
  const upvotes = summary.upvotes || 0;
  const downvotes = summary.downvotes || 0;

  return {
    upvotes,
    downvotes,
    helpful_score: upvotes - downvotes
  };
}

/**
 * Add review to a track
 * Automatically sets is_mi_review flag if user is MI reviewer
 */
exports.addReview = [
  requireAuth,
  async (req, res) => {
    const { trackId, text, score1, score2, score3, score4, score5 } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const isMIReviewer = isAdmin || req.user.is_mi_reviewer || false;

    // Validate required fields
    if (!trackId) {
      return res.status(400).json({ error: 'Track ID is required' });
    }

    // Parse and validate trackId
    const parsedTrackId = parseInt(trackId);
    if (isNaN(parsedTrackId) || parsedTrackId <= 0) {
      return res.status(400).json({ error: 'Invalid track ID' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Review text is required' });
    }

    // Validate text length
    const sanitizedText = text.trim();
    if (sanitizedText.length < 10) {
      return res.status(400).json({ error: 'Review text must be at least 10 characters' });
    }
    if (sanitizedText.length > 5000) {
      return res.status(400).json({ error: 'Review text must not exceed 5000 characters' });
    }

    // Parse and validate scores
    const scores = [score1, score2, score3, score4, score5].map(s => parseInt(s));
    if (scores.some(s => isNaN(s))) {
      return res.status(400).json({ error: 'All scores must be valid numbers' });
    }
    if (scores.some(s => s < 1 || s > 10)) {
      return res.status(400).json({ error: 'Scores must be between 1 and 10' });
    }

    try {
      // Check if track exists and is approved
      const trackCheck = await query('SELECT id, status FROM tracks WHERE id = $1', [parsedTrackId]);
      if (trackCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Track not found' });
      }

      if (trackCheck.rows[0].status !== 'approved') {
        return res.status(400).json({ error: 'Can only review approved tracks' });
      }

      // Basic anti-spam protection: limit posting frequency
      const recentReviewsResult = await query(
        `SELECT COUNT(*)::int AS count
         FROM reviews
         WHERE user_id = $1
           AND created_at > NOW() - INTERVAL '15 minutes'`,
        [userId]
      );
      if ((recentReviewsResult.rows[0]?.count || 0) >= 5) {
        return res.status(429).json({ error: 'Too many reviews in a short period. Please try again later.' });
      }

      // Prevent posting the same review text repeatedly
      const duplicateTextResult = await query(
        `SELECT id
         FROM reviews
         WHERE user_id = $1
           AND LOWER(TRIM(text)) = LOWER(TRIM($2))
           AND created_at > NOW() - INTERVAL '7 days'
         LIMIT 1`,
        [userId, sanitizedText]
      );
      if (duplicateTextResult.rows.length > 0) {
        return res.status(409).json({ error: 'Duplicate review detected. Please post a unique review text.' });
      }

      // Check if status column exists
      const statusColumnExists = await columnExists('reviews', 'status');

      // Prevent repeated reviews for the same release
      let latestUserReviewResult;
      if (statusColumnExists) {
        latestUserReviewResult = await query(
          `SELECT id, status, created_at
           FROM reviews
           WHERE user_id = $1 AND track_id = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, parsedTrackId]
        );
      } else {
        latestUserReviewResult = await query(
          `SELECT id, created_at
           FROM reviews
           WHERE user_id = $1 AND track_id = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId, parsedTrackId]
        );
      }

      if (latestUserReviewResult.rows.length > 0) {
        const latest = latestUserReviewResult.rows[0];
        const latestStatus = latest.status || 'approved';

        if (latestStatus === 'approved') {
          return res.status(409).json({ error: 'You already have an approved review for this release.' });
        }

        if (latestStatus === 'pending') {
          return res.status(409).json({ error: 'You already have a pending review for this release.' });
        }

        // For rejected reviews, enforce cooldown before reposting
        const cooldownDeadline = new Date(latest.created_at).getTime() + (24 * 60 * 60 * 1000);
        if (!Number.isNaN(cooldownDeadline) && Date.now() < cooldownDeadline) {
          return res.status(429).json({ error: 'Please wait before resubmitting a review for this release.' });
        }
      }

      // Calculate average score (use parsed scores)
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      // Determine review status: admins auto-approve, others go to moderation
      const reviewStatus = isAdmin ? 'approved' : 'pending';
      const approvedAt = isAdmin ? new Date() : null;
      const approvedBy = isAdmin ? userId : null;

      // Add review with MI flag and moderation status (if column exists)
      let result;
      if (statusColumnExists) {
        result = await query(
          `INSERT INTO reviews (track_id, user_id, text, score1, score2, score3, score4, score5, avg_score, is_mi_review, status, approved_at, approved_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
          [parsedTrackId, userId, sanitizedText, scores[0], scores[1], scores[2], scores[3], scores[4], avgScore, isMIReviewer, reviewStatus, approvedAt, approvedBy]
        );
      } else {
        // Fallback: insert without status columns
        result = await query(
          `INSERT INTO reviews (track_id, user_id, text, score1, score2, score3, score4, score5, avg_score, is_mi_review)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [parsedTrackId, userId, sanitizedText, scores[0], scores[1], scores[2], scores[3], scores[4], avgScore, isMIReviewer]
        );
      }

      res.json({
        success: true,
        review: result.rows[0],
        message: isAdmin ? 'Review published successfully' : 'Review submitted for moderation'
      });
    } catch (error) {
      const { handleDatabaseError, handleServerError, handleClientError } = require('./utils/errors');

      // Check if it's a database error
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      // Validation errors
      if (error.message && error.message.includes('required')) {
        return handleClientError(res, error.message, 400);
      }

      // Generic server error
      return handleServerError(res, error, 'addReview');
    }
  }
];

exports.voteReview = [
  requireAuth,
  async (req, res) => {
    const reviewId = parseInt(req.params.id, 10);
    const vote = normalizeVote(req.body?.vote);

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    if (vote === null) {
      return res.status(400).json({ error: 'Vote must be up, down, 1, -1, or 0 to remove vote' });
    }

    try {
      const votesTableExists = await tableExists('review_votes');
      if (!votesTableExists) {
        return res.status(400).json({ error: 'Review voting is not available. Please run migration 011.' });
      }

      const statusColumnExists = await columnExists('reviews', 'status');
      const reviewCheck = await query(
        `SELECT r.id, r.status AS review_status, t.status AS track_status
         FROM reviews r
         JOIN tracks t ON t.id = r.track_id
         WHERE r.id = $1`,
        [reviewId]
      );

      if (reviewCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }

      const reviewRow = reviewCheck.rows[0];
      if (reviewRow.track_status !== 'approved') {
        return res.status(400).json({ error: 'Voting is available only for approved tracks' });
      }

      if (statusColumnExists && reviewRow.review_status && reviewRow.review_status !== 'approved') {
        return res.status(400).json({ error: 'Voting is available only for approved reviews' });
      }

      if (vote === 0) {
        await query(
          `DELETE FROM review_votes WHERE review_id = $1 AND user_id = $2`,
          [reviewId, req.user.id]
        );
      } else {
        await query(
          `INSERT INTO review_votes (review_id, user_id, vote)
           VALUES ($1, $2, $3)
           ON CONFLICT (review_id, user_id)
           DO UPDATE SET vote = EXCLUDED.vote, updated_at = NOW()`,
          [reviewId, req.user.id, vote]
        );
      }

      const summary = await getReviewVoteSummary(reviewId);
      return res.json({
        success: true,
        reviewId,
        my_vote: vote,
        ...summary
      });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');

      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }

      return handleServerError(res, error, 'voteReview');
    }
  }
];

exports.getReviewsByTrack = async (req, res) => {
  const { id } = req.params;

  try {
    // Validate track ID
    const trackId = parseInt(id, 10);
    if (!id || isNaN(trackId) || trackId <= 0) {
      return res.status(400).json({ error: 'Invalid track ID' });
    }

    // First check if track exists and is approved
    const trackCheck = await query(
      'SELECT id, status FROM tracks WHERE id = $1',
      [trackId]
    );

    if (trackCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (trackCheck.rows[0].status !== 'approved') {
      // Track exists but not approved - return empty reviews
      return res.json({ reviews: [] });
    }

    const statusColumnExists = await columnExists('reviews', 'status');
    const votesEnabled = await tableExists('review_votes');
    const optionalUserId = getOptionalUserId(req);
    const includeMyVote = Boolean(votesEnabled && optionalUserId);

    const voteSelect = buildVoteSelectFields(votesEnabled, includeMyVote);
    const voteJoins = buildVoteJoins(votesEnabled, includeMyVote, '$2');

    let queryText = `
      SELECT
        r.*,
        u.name as author_name,
        u.avatar as author_avatar
        ${voteSelect}
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      ${voteJoins}
      WHERE r.track_id = $1
    `;

    if (statusColumnExists) {
      queryText += ` AND (r.status = 'approved' OR r.status IS NULL)`;
    }

    queryText += ` ORDER BY r.created_at DESC`;

    const params = [trackId];
    if (includeMyVote) {
      params.push(optionalUserId);
    }

    const result = await query(queryText, params);

    // Always return reviews array, even if empty
    res.json({ reviews: result.rows || [] });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');

    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }

    return handleServerError(res, error, 'getReviewsByTrack');
  }
};

exports.getLatestReviews = async (req, res) => {
  try {
    // Only show reviews for approved tracks
    const statusColumnExists = await columnExists('reviews', 'status');
    const votesEnabled = await tableExists('review_votes');
    const optionalUserId = getOptionalUserId(req);
    const includeMyVote = Boolean(votesEnabled && optionalUserId);

    const voteSelect = buildVoteSelectFields(votesEnabled, includeMyVote);
    const voteJoins = buildVoteJoins(votesEnabled, includeMyVote, '$1');

    let queryText = `
      SELECT
        r.*,
        t.title as track_title,
        t.artist as track_artist,
        t.cover as track_cover,
        u.name as author_name,
        u.avatar as author_avatar
        ${voteSelect}
      FROM reviews r
      JOIN tracks t ON r.track_id = t.id
      LEFT JOIN users u ON r.user_id = u.id
      ${voteJoins}
      WHERE t.status = 'approved'
    `;

    if (statusColumnExists) {
      queryText += ` AND (r.status = 'approved' OR r.status IS NULL)`;
    }

    queryText += ` ORDER BY r.created_at DESC LIMIT 10`;

    const params = [];
    if (includeMyVote) {
      params.push(optionalUserId);
    }

    const result = await query(queryText, params);
    res.json({ reviews: result.rows || [] });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');

    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }

    return handleServerError(res, error, 'getLatestReviews');
  }
};

exports.generateMIReview = [
  requireAuth,
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
        text: `Music Inspector AI рецензия: "${track.title}" от ${track.artist}. Релиз показывает цельное звучание и уверенную реализацию музыкальной идеи.`,
        score1: Math.floor(Math.random() * 3) + 7, // 7-9
        score2: Math.floor(Math.random() * 3) + 7,
        score3: Math.floor(Math.random() * 3) + 7,
        score4: Math.floor(Math.random() * 3) + 7,
        score5: Math.floor(Math.random() * 3) + 7
      };

      const avgScore = (aiReview.score1 + aiReview.score2 + aiReview.score3 + aiReview.score4 + aiReview.score5) / 5;

      // Check if status column exists
      const statusColumnExists = await columnExists('reviews', 'status');

      // Add AI review with MI flag (since it's generated by system)
      // Auto-approve AI reviews
      let result;
      if (statusColumnExists) {
        result = await query(
          'INSERT INTO reviews (track_id, user_id, text, score1, score2, score3, score4, score5, avg_score, is_ai, is_mi_review, status, approved_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
          [trackId, null, aiReview.text, aiReview.score1, aiReview.score2, aiReview.score3, aiReview.score4, aiReview.score5, avgScore, true, true, 'approved', new Date()]
        );
      } else {
        result = await query(
          'INSERT INTO reviews (track_id, user_id, text, score1, score2, score3, score4, score5, avg_score, is_ai, is_mi_review) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
          [trackId, null, aiReview.text, aiReview.score1, aiReview.score2, aiReview.score3, aiReview.score4, aiReview.score5, avgScore, true, true]
        );
      }

      res.json({ success: true, review: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
];
