const { query } = require('./db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Authentication middleware - verifies JWT token and attaches user to request
 */
exports.requireAuth = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch full user data including role, is_mi_reviewer, and avatar
    const result = await query(
      'SELECT id, name, email, role, is_mi_reviewer, avatar FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Admin-only middleware - requires user to have admin role
 */
exports.requireAdmin = [
  exports.requireAuth,
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  }
];

/**
 * Get current user endpoint - returns full user object with role and avatar
 */
exports.getCurrentUser = async (req, res) => {
  const token = req.cookies?.token;
  
  if (!token) {
    return res.json({ user: null });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await query(
      'SELECT id, name, email, role, is_mi_reviewer, avatar FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ user: null });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('getCurrentUser error:', error.message);
    res.json({ user: null });
  }
};





