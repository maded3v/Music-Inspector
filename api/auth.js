const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./db');
const { columnExists } = require('./utils/dbHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function getCookieOptions(req, includeMaxAge = true) {
  const isProduction = process.env.NODE_ENV === 'production';
  let sameSite = 'lax';
  let secure = isProduction;

  const origin = req.get('origin');

  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const requestHost = req.hostname;
      const isCrossSiteRequest = originHost !== requestHost;

      if (isCrossSiteRequest) {
        sameSite = 'none';
        secure = true;
      }
    } catch (error) {
      // Keep defaults when origin is not a valid URL
    }
  }

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/'
  };

  if (includeMaxAge) {
    options.maxAge = 7 * 24 * 60 * 60 * 1000;
  }

  return options;
}

async function getUsersColumnsState() {
  const [hasRole, hasMiReviewer, hasAvatar, hasIsBanned] = await Promise.all([
    columnExists('users', 'role'),
    columnExists('users', 'is_mi_reviewer'),
    columnExists('users', 'avatar'),
    columnExists('users', 'is_banned')
  ]);

  return { hasRole, hasMiReviewer, hasAvatar, hasIsBanned };
}

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { 
          name: !name ? 'Name is required' : null,
          email: !email ? 'Email is required' : null,
          password: !password ? 'Password is required' : null
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    const existingUser = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with default role 'user' and is_mi_reviewer = false
    // Handle case where role column might not exist (fallback for older schemas)
    let result;
    try {
      result = await query(
        'INSERT INTO users (name, email, password, role, is_mi_reviewer) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, is_mi_reviewer',
        [name, email, hashedPassword, 'user', false]
      );
    } catch (dbError) {
      // If role column doesn't exist, try without it (for older schema)
      if (dbError.message && dbError.message.includes('column "role"')) {
        console.warn('Role column not found, using fallback INSERT');
        result = await query(
          'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
          [name, email, hashedPassword]
        );
        // Add default role and is_mi_reviewer to result
        result.rows[0].role = 'user';
        result.rows[0].is_mi_reviewer = false;
      } else {
        throw dbError;
      }
    }

    const user = result.rows[0];

    // Ensure role and is_mi_reviewer exist (fallback for older schemas)
    const userRole = user.role || 'user';
    const isMiReviewer = user.is_mi_reviewer !== undefined ? user.is_mi_reviewer : false;

    // Generate token with role and is_mi_reviewer
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: userRole,
        is_mi_reviewer: isMiReviewer
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.cookie('token', token, getCookieOptions(req));

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRole,
        is_mi_reviewer: isMiReviewer
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    
    // Use standardized error handling
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    // Generic server error
    return handleServerError(res, error, 'registration');
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const { hasRole, hasMiReviewer, hasIsBanned } = await getUsersColumnsState();

    // Find user
    const result = await query(
      `SELECT
        id,
        name,
        email,
        password,
        ${hasRole ? 'role' : "'user'::text AS role"},
        ${hasMiReviewer ? 'is_mi_reviewer' : 'FALSE AS is_mi_reviewer'},
        ${hasIsBanned ? 'COALESCE(is_banned, FALSE)' : 'FALSE'} AS is_banned
       FROM users
       WHERE email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account is banned' });
    }

    // Generate token with role and is_mi_reviewer
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        is_mi_reviewer: user.is_mi_reviewer
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.cookie('token', token, getCookieOptions(req));

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role: user.role,
        is_mi_reviewer: user.is_mi_reviewer
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    const { handleDatabaseError, handleServerError } = require('./utils/errors');
    
    // Check if it's a database error
    if (error.code || error.isConnectionError) {
      return handleDatabaseError(res, error);
    }
    
    // Generic server error
    return handleServerError(res, error, 'login');
  }
};

exports.authenticate = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

exports.getUser = [
  exports.authenticate,
  async (req, res) => {
    try {
      const { hasRole, hasMiReviewer, hasAvatar, hasIsBanned } = await getUsersColumnsState();

      const result = await query(
        `SELECT
          id,
          name,
          email,
          ${hasRole ? 'role' : "'user'::text AS role"},
          ${hasMiReviewer ? 'is_mi_reviewer' : 'FALSE AS is_mi_reviewer'},
          ${hasAvatar ? 'avatar' : 'NULL AS avatar'},
          ${hasIsBanned ? 'COALESCE(is_banned, FALSE)' : 'FALSE'} AS is_banned
         FROM users
         WHERE id = $1`,
        [req.user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (result.rows[0].is_banned) {
        res.clearCookie('token', getCookieOptions(req, false));
        return res.status(403).json({ error: 'Your account is banned' });
      }
      
      res.json({ user: result.rows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
];

/**
 * Logout user - clears the authentication cookie
 */
exports.logout = async (req, res) => {
  try {
    res.clearCookie('token', getCookieOptions(req, false));
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
};
