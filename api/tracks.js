const { query } = require('./db');
const { authenticate } = require('./auth');

exports.createTrack = [
  authenticate,
  async (req, res) => {
    const { title, artist, type, cover, link } = req.body;
    const userId = req.user.id;

    try {
      const result = await query(
        'INSERT INTO tracks (title, artist, type, cover, link, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [title, artist, type, cover, link, userId]
      );
      res.json({ success: true, track: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
];

exports.getLatestTracks = async (req, res) => {
  try {
    const result = await query(
      'SELECT t.*, u.name as creator_name FROM tracks t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 10'
    );
    res.json({ tracks: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getCatalog = async (req, res) => {
  const { search, type, sort = 'created_at', order = 'desc' } = req.query;

  try {
    let queryText = 'SELECT t.*, u.name as creator_name FROM tracks t LEFT JOIN users u ON t.user_id = u.id WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      queryText += ` AND (t.title ILIKE $${paramIndex} OR t.artist ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (type) {
      queryText += ` AND t.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    queryText += ` ORDER BY t.${sort} ${order.toUpperCase()}`;

    const result = await query(queryText, params);
    res.json({ tracks: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getTrack = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      'SELECT t.*, u.name as creator_name FROM tracks t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    res.json({ track: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
