const { query, pool } = require('./db');
const { requireAuth } = require('./middleware');
const artistRoutes = require('./artists');
const { columnExists } = require('./utils/dbHelpers');

/**
 * Create track/release with moderation workflow
 * - Admin submissions: approved immediately
 * - User submissions: pending moderation
 */
exports.createTrack = [
  requireAuth,
  async (req, res) => {
    const { title, artist, type, cover, link, artist_id, release_date, releaseDate } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!artist || !artist.trim()) {
      return res.status(400).json({ error: 'Artist is required' });
    }
    if (!type || !['single', 'album', 'ep'].includes(type.toLowerCase())) {
      return res.status(400).json({ error: 'Type must be single, album, or ep' });
    }

    // Trim and sanitize inputs
    const sanitizedTitle = title.trim();
    const sanitizedArtist = artist.trim();
    const sanitizedType = type.toLowerCase();
    const sanitizedLink = link ? link.trim() : null;
    const rawReleaseDate = release_date || releaseDate || null;

    let sanitizedReleaseDate = null;
    if (rawReleaseDate) {
      if (typeof rawReleaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawReleaseDate)) {
        return res.status(400).json({ error: 'release_date must be in YYYY-MM-DD format' });
      }

      const parsedReleaseDate = new Date(`${rawReleaseDate}T00:00:00Z`);
      if (Number.isNaN(parsedReleaseDate.getTime())) {
        return res.status(400).json({ error: 'Invalid release_date' });
      }

      sanitizedReleaseDate = rawReleaseDate;
    }

    try {
      // Determine status based on user role
      const status = isAdmin ? 'approved' : 'pending';
      const approvedAt = isAdmin ? new Date() : null;
      const approvedBy = isAdmin ? userId : null;

      // Use transaction for atomicity
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Check if artist exists and link if found
        let linkedArtistId = artist_id || null;
        if (!linkedArtistId && sanitizedArtist) {
          const existingArtist = await artistRoutes.getArtistByName(sanitizedArtist);
          if (existingArtist) {
            linkedArtistId = existingArtist.id;
          }
        }

        // Insert track
        const hasReleaseDateColumn = await columnExists('tracks', 'release_date');

        let trackResult;
        if (hasReleaseDateColumn) {
          trackResult = await client.query(
            `INSERT INTO tracks (title, artist, type, cover, link, user_id, status, approved_at, approved_by, artist_id, release_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [sanitizedTitle, sanitizedArtist, sanitizedType, cover, sanitizedLink, userId, status, approvedAt, approvedBy, linkedArtistId, sanitizedReleaseDate]
          );
        } else {
          trackResult = await client.query(
            `INSERT INTO tracks (title, artist, type, cover, link, user_id, status, approved_at, approved_by, artist_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [sanitizedTitle, sanitizedArtist, sanitizedType, cover, sanitizedLink, userId, status, approvedAt, approvedBy, linkedArtistId]
          );
        }

        const track = trackResult.rows[0];

        await client.query('COMMIT');

        res.json({ 
          success: true, 
          track,
          message: isAdmin 
            ? 'Release published successfully' 
            : 'Release submitted for moderation'
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
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
      return handleServerError(res, error, 'createTrack');
    }
  }
];

/**
 * Batch rating calculation to avoid N+1 queries.
 */
async function getTrackRatingsMap(trackIds) {
  const uniqueTrackIds = Array.from(
    new Set((trackIds || []).map(id => parseInt(id, 10)).filter(id => Number.isInteger(id) && id > 0))
  );

  const ratingsMap = new Map();
  if (uniqueTrackIds.length === 0) {
    return ratingsMap;
  }

  const statusColumnExists = await columnExists('reviews', 'status');

  let queryText = `
    SELECT
      r.track_id,
      ROUND(AVG(r.avg_score) FILTER (WHERE COALESCE(r.is_mi_review, FALSE) = FALSE)::numeric, 1) AS people_score,
      ROUND(AVG(r.avg_score) FILTER (WHERE COALESCE(r.is_mi_review, FALSE) = TRUE)::numeric, 1) AS mi_score
    FROM reviews r
    WHERE r.track_id = ANY($1::int[])
  `;

  if (statusColumnExists) {
    queryText += ` AND (r.status = 'approved' OR r.status IS NULL)`;
  }

  queryText += ` GROUP BY r.track_id`;

  const result = await query(queryText, [uniqueTrackIds]);
  for (const row of result.rows) {
    ratingsMap.set(row.track_id, {
      peopleScore: row.people_score !== null ? parseFloat(row.people_score) : null,
      miScore: row.mi_score !== null ? parseFloat(row.mi_score) : null
    });
  }

  return ratingsMap;
}

exports.getLatestTracks = async (req, res) => {
  try {
    // Only show approved tracks to public
    // Include artist information if artist_id exists
    const result = await query(
      `SELECT t.*, u.name as creator_name,
              a.id as artist_id, a.name as artist_name, a.image_path as artist_image
       FROM tracks t 
       LEFT JOIN users u ON t.user_id = u.id 
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE t.status = 'approved'
       ORDER BY t.created_at DESC 
       LIMIT 50`
    );
    
    const ratingsMap = await getTrackRatingsMap(result.rows.map(track => track.id));
    const tracksWithRatings = result.rows.map((track) => {
      const ratings = ratingsMap.get(track.id) || { peopleScore: null, miScore: null };
      return {
        ...track,
        peopleScore: ratings.peopleScore,
        miScore: ratings.miScore
      };
    });
    
    res.json({ tracks: tracksWithRatings });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'getLatestTracks');
  }
};

/**
 * Get monthly albums - exactly 6 highest-rated albums from current month
 */
exports.getMonthlyAlbums = async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get start and end of current month
    // Use PostgreSQL date functions for reliable month filtering
    const result = await query(
      `SELECT t.*, u.name as creator_name,
              a.id as artist_id, a.name as artist_name, a.image_path as artist_image
       FROM tracks t 
       LEFT JOIN users u ON t.user_id = u.id 
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE t.status = 'approved'
         AND t.type = 'album'
         AND EXTRACT(YEAR FROM t.created_at) = $1
         AND EXTRACT(MONTH FROM t.created_at) = $2
       ORDER BY t.created_at DESC`,
      [currentYear, currentMonth + 1] // PostgreSQL months are 1-12
    );
    
    const ratingsMap = await getTrackRatingsMap(result.rows.map(album => album.id));
    const albumsWithRatings = result.rows.map((album) => {
      const ratings = ratingsMap.get(album.id) || { peopleScore: null, miScore: null };
      const { peopleScore, miScore } = ratings;
      
      // Calculate total rating (average of peopleScore and miScore)
      let totalRating = null;
      if (peopleScore !== null && miScore !== null) {
        totalRating = (peopleScore + miScore) / 2;
      } else if (peopleScore !== null) {
        totalRating = peopleScore;
      } else if (miScore !== null) {
        totalRating = miScore;
      }
      
      return {
        ...album,
        peopleScore,
        miScore,
        totalRating
      };
    });
    
    // Sort by highest total rating, then by newest if no rating
    const sortedAlbums = albumsWithRatings.sort((a, b) => {
      if (a.totalRating !== null && b.totalRating !== null) {
        return b.totalRating - a.totalRating;
      } else if (a.totalRating !== null) {
        return -1;
      } else if (b.totalRating !== null) {
        return 1;
      } else {
        return new Date(b.created_at) - new Date(a.created_at);
      }
    });
    
    // Take exactly 6 highest-rated albums
    const topAlbums = sortedAlbums.slice(0, 6);
    
    res.json({ albums: topAlbums });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'getMonthlyAlbums');
  }
};

exports.getCatalog = async (req, res) => {
  const { search, type, sort = 'created_at', order = 'desc' } = req.query;

  try {
    // Validate and sanitize sort and order parameters to prevent SQL injection
    const allowedSortFields = ['created_at', 'release_date', 'title', 'artist', 'type'];
    const allowedOrders = ['asc', 'desc'];
    
    const sanitizedSort = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sanitizedOrder = allowedOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';

    // Only show approved tracks to public
    // Include artist information if artist_id exists
    let queryText = `SELECT t.*, u.name as creator_name,
                            a.id as artist_id, a.name as artist_name, a.image_path as artist_image
                     FROM tracks t 
                     LEFT JOIN users u ON t.user_id = u.id 
                     LEFT JOIN artists a ON t.artist_id = a.id
                     WHERE t.status = 'approved'`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      queryText += ` AND (t.title ILIKE $${paramIndex} OR t.artist ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (type) {
      queryText += ` AND t.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    queryText += ` ORDER BY t.${sanitizedSort} ${sanitizedOrder}`;

    const result = await query(queryText, params);
    res.json({ tracks: result.rows || [] });
  } catch (error) {
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'getCatalog');
  }
};

exports.getTrack = async (req, res) => {
  const { id } = req.params;

  try {
    // Only show approved tracks to public (admins can see all via admin endpoint)
    // Include artist information if artist_id exists
    const result = await query(
      `SELECT t.*, u.name as creator_name,
              a.id as artist_id, a.name as artist_name, a.image_path as artist_image
       FROM tracks t 
       LEFT JOIN users u ON t.user_id = u.id 
       LEFT JOIN artists a ON t.artist_id = a.id
       WHERE t.id = $1 AND t.status = 'approved'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const track = result.rows[0];
    
    const ratingsMap = await getTrackRatingsMap([id]);
    const { peopleScore, miScore } = ratingsMap.get(parseInt(id, 10)) || { peopleScore: null, miScore: null };
    
    // Add calculated scores to track
    track.peopleScore = peopleScore;
    track.miScore = miScore;

    res.json({ track });
  } catch (error) {
    const { handleDatabaseError, handleServerError, handleNotFoundError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    return handleServerError(res, error, 'getTrack');
  }
};
