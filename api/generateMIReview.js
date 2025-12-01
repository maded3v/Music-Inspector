const jwt = require('jsonwebtoken');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function authenticate(req) {
  const token = req.cookies.token;

  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = authenticate(req);
    const { trackId } = req.body;

    // Get track info
    const trackResult = await query('SELECT * FROM tracks WHERE id = $1', [trackId]);
    if (trackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const track = trackResult.rows[0];

    // Generate random review
    const ratings = {
      production: Math.floor(Math.random() * 5) + 6, // 6-10
      melody: Math.floor(Math.random() * 5) + 6,
      lyrics: Math.floor(Math.random() * 5) + 6,
      innovation: Math.floor(Math.random() * 5) + 6,
      overall: Math.floor(Math.random() * 5) + 6
    };

    const comments = [
      "This track has incredible potential and shows great artistic vision.",
      "A solid release that demonstrates technical proficiency and creative insight.",
      "The production quality is impressive, with attention to detail throughout.",
      "This piece stands out with its unique approach and execution.",
      "Well-crafted music that deserves recognition in the scene."
    ];

    const randomComment = comments[Math.floor(Math.random() * comments.length)];

    // Save MI review
    const reviewResult = await query(`
      INSERT INTO reviews (track_id, user_id, production_rating, melody_rating, lyrics_rating, innovation_rating, overall_rating, comment, is_mi_review)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING *
    `, [trackId, user.id, ratings.production, ratings.melody, ratings.lyrics, ratings.innovation, ratings.overall, randomComment]);

    res.json({
      success: true,
      review: reviewResult.rows[0],
      ratings,
      comment: randomComment
    });
  } catch (error) {
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}
