const { query } = require('./db');
const jwt = require('jsonwebtoken');
const { columnExists } = require('./utils/dbHelpers');
const { ensureCsrfCookie, clearCsrfCookie } = require('./utils/csrf');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SUPER_ADMIN_EMAILS = new Set(['quwewe@gmail.com']);

function getCookieClearOptions(req) {
  const isProduction = process.env.NODE_ENV === 'production';
  let sameSite = 'lax';
  let secure = isProduction;

  const origin = req.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const requestHost = req.hostname;
      if (originHost !== requestHost) {
        sameSite = 'none';
        secure = true;
      }
    } catch (error) {
      // Keep defaults when origin is not a valid URL
    }
  }

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/'
  };
}

async function getUsersColumnsState() {
  const [hasAvatar, hasRole, hasMiReviewer, hasIsBanned] = await Promise.all([
    columnExists('users', 'avatar'),
    columnExists('users', 'role'),
    columnExists('users', 'is_mi_reviewer'),
    columnExists('users', 'is_banned')
  ]);

  return { hasAvatar, hasRole, hasMiReviewer, hasIsBanned };
}

async function getUserByIdWithSafeColumns(userId) {
  const { hasAvatar, hasRole, hasMiReviewer, hasIsBanned } = await getUsersColumnsState();
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
    [userId]
  );

  const user = result.rows[0] || null;
  if (!user) {
    return null;
  }

  const normalizedEmail = String(user.email || '').toLowerCase();
  if (SUPER_ADMIN_EMAILS.has(normalizedEmail) && user.role !== 'admin') {
    user.role = 'admin';

    if (hasRole) {
      query(`UPDATE users SET role = 'admin' WHERE id = $1 AND role <> 'admin'`, [userId]).catch((error) => {
        console.error('Failed to persist super-admin role:', error.message);
      });
    }
  }

  return user;
}

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

    const user = await getUserByIdWithSafeColumns(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.is_banned) {
      res.clearCookie('token', getCookieClearOptions(req));
      clearCsrfCookie(req, res);
      return res.status(403).json({ error: 'Your account is banned' });
    }

    req.user = user;
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

    const user = await getUserByIdWithSafeColumns(decoded.id);
    if (!user) {
      return res.json({ user: null });
    }

    if (user.is_banned) {
      res.clearCookie('token', getCookieClearOptions(req));
      clearCsrfCookie(req, res);
      return res.json({ user: null });
    }

    ensureCsrfCookie(req, res);
    res.json({ user });
  } catch (error) {
    console.error('getCurrentUser error:', error.message);
    res.json({ user: null });
  }
};



