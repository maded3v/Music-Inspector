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
    const { title, artist, genre, releaseDate, coverUrl, description } = req.body;

    const result = await query(
      'INSERT INTO tracks (title, artist, genre, release_date, cover_url, description, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [title, artist, genre, releaseDate, coverUrl, description, user.id]
    );

    res.json({ success: true, track: result.rows[0] });
  } catch (error) {
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: error.message });
    }
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}
