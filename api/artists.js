const { query } = require('./db');
const { requireAuth, requireAdmin } = require('./middleware');
const { columnExists } = require('./utils/dbHelpers');

/**
 * Get all artists (public endpoint)
 */
exports.getAllArtists = async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    
    // Validate and sanitize pagination parameters
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100); // Max 100
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);
    
    let queryText = 'SELECT * FROM artists WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search && search.trim()) {
      queryText += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    queryText += ` ORDER BY name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parsedLimit, parsedOffset);

    const result = await query(queryText, params);
    res.json({ artists: result.rows || [] });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'getAllArtists');
  }
};

/**
 * Get artist by ID (public endpoint)
 */
exports.getArtist = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('SELECT * FROM artists WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    res.json({ artist: result.rows[0] });
  } catch (error) {
    const { handleDatabaseError, handleServerError, handleNotFoundError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'getArtist');
  }
};

/**
 * Get artist by name (case-insensitive, for linking)
 */
exports.getArtistByName = async (name) => {
  try {
    const result = await query(
      'SELECT * FROM artists WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Create artist (authenticated users can create)
 */
exports.createArtist = [
  requireAuth,
  async (req, res) => {
    const { name, bio, image_path } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Artist name is required' });
    }

    const sanitizedName = name.trim();
    if (sanitizedName.length > 200) {
      return res.status(400).json({ error: 'Artist name must not exceed 200 characters' });
    }

    if (bio && bio.length > 2000) {
      return res.status(400).json({ error: 'Bio must not exceed 2000 characters' });
    }

    try {
      // Check if artist already exists (case-insensitive)
      const existing = await exports.getArtistByName(sanitizedName);
      if (existing) {
        return res.status(400).json({ 
          error: 'Artist already exists',
          artist: existing 
        });
      }

      // Create artist
      const result = await query(
        'INSERT INTO artists (name, bio, image_path) VALUES ($1, $2, $3) RETURNING *',
        [sanitizedName, bio ? bio.trim() : null, image_path || null]
      );

      res.json({ success: true, artist: result.rows[0] });
    } catch (error) {
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      // Check if it's a database error
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'createArtist');
    }
  }
];

/**
 * Update artist (admin only)
 */
exports.updateArtist = [
  requireAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { name, bio, image_path } = req.body;

    try {
      // Check if artist exists
      const artistCheck = await query('SELECT id FROM artists WHERE id = $1', [id]);
      if (artistCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Artist not found' });
      }

      // Build update query dynamically
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(name.trim());
        paramIndex++;
      }

      if (bio !== undefined) {
        updates.push(`bio = $${paramIndex}`);
        params.push(bio);
        paramIndex++;
      }

      if (image_path !== undefined) {
        updates.push(`image_path = $${paramIndex}`);
        params.push(image_path);
        paramIndex++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      params.push(id);
      const queryText = `UPDATE artists SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

      const result = await query(queryText, params);
      res.json({ success: true, artist: result.rows[0] });
    } catch (error) {
      console.error(error);
      const { handleDatabaseError, handleServerError } = require('./utils/errors');
      
      // Check if it's a database error
      if (error.code || error.isConnectionError) {
        return handleDatabaseError(res, error);
      }
      
      return handleServerError(res, error, 'updateArtist');
    }
  }
];

/**
 * Search artists (for autocomplete)
 */
exports.searchArtists = async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json({ artists: [] });
  }

  try {
    const result = await query(
      'SELECT id, name, image_path FROM artists WHERE name ILIKE $1 ORDER BY name ASC LIMIT 10',
      [`%${q.trim()}%`]
    );

    res.json({ artists: result.rows || [] });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'searchArtists');
  }
};

/**
 * Get artist with stats (overall rating, user rating, releases)
 */
exports.getArtistWithStats = [
  async (req, res) => {
    const { id } = req.params;
    // Get user from token if available (optional auth)
    const token = req.cookies?.token;
    let userId = null;
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
      } catch (e) {
        // Invalid token, continue without user
      }
    }

  try {
    // Get artist info
    const artistResult = await query('SELECT * FROM artists WHERE id = $1', [id]);
    if (artistResult.rows.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    const artist = artistResult.rows[0];

    // Get all approved tracks by this artist
    const tracksResult = await query(
      `SELECT t.*, u.name as creator_name 
       FROM tracks t 
       LEFT JOIN users u ON t.user_id = u.id 
       WHERE (t.artist_id = $1 OR (t.artist_id IS NULL AND LOWER(t.artist) = LOWER($2)))
       AND t.status = 'approved'
       ORDER BY t.created_at DESC`,
      [id, artist.name]
    );
    const tracks = tracksResult.rows;

    // Calculate overall rating from all reviews of artist's tracks
    let overallRating = null;
    let myRating = null;
    let reviewCount = 0;

    if (tracks.length > 0) {
      const trackIds = tracks.map(t => t.id);
      const placeholders = trackIds.map((_, i) => `$${i + 1}`).join(',');
      
      // Get all reviews for artist's tracks
      // Handle missing status column gracefully
      const statusColumnExists = await columnExists('reviews', 'status');
      
      let reviewsQuery;
      if (statusColumnExists) {
        reviewsQuery = `SELECT r.avg_score, r.user_id 
                        FROM reviews r 
                        JOIN tracks t ON r.track_id = t.id
                        WHERE r.track_id IN (${placeholders}) 
                        AND t.status = 'approved'
                        AND (r.status = 'approved' OR r.status IS NULL)`;
      } else {
        reviewsQuery = `SELECT r.avg_score, r.user_id 
                        FROM reviews r 
                        JOIN tracks t ON r.track_id = t.id
                        WHERE r.track_id IN (${placeholders}) 
                        AND t.status = 'approved'`;
      }
      
      const reviewsResult = await query(reviewsQuery, trackIds);
      
      const reviews = reviewsResult.rows;
      reviewCount = reviews.length;

      if (reviews.length > 0) {
        const totalScore = reviews.reduce((sum, r) => sum + parseFloat(r.avg_score), 0);
        overallRating = totalScore / reviews.length;

        // Find user's rating if logged in
        if (userId) {
          const userReview = reviews.find(r => r.user_id === userId);
          if (userReview) {
            myRating = parseFloat(userReview.avg_score);
          } else {
            // Default to 0.0 if user has no ratings for this artist
            myRating = 0.0;
          }
        }
      }
    }

    res.json({
      artist,
      tracks,
      stats: {
        overallRating: overallRating ? Math.round(overallRating * 10) / 10 : null,
        myRating: myRating !== null ? Math.round(myRating * 10) / 10 : null,
        reviewCount,
        trackCount: tracks.length
      }
    });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'getArtistWithStats');
  }
  }
];



