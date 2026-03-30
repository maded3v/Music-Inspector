const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/api/login', '/api/register']);
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
    httpOnly: false,
    secure,
    sameSite,
    path: '/'
  };

  if (includeMaxAge) {
    options.maxAge = 7 * 24 * 60 * 60 * 1000;
  }

  return options;
}

function issueCsrfCookie(req, res) {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions(req));
  return token;
}

function ensureCsrfCookie(req, res) {
  if (!req.cookies?.token) {
    return null;
  }

  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (existing) {
    return existing;
  }

  return issueCsrfCookie(req, res);
}

function clearCsrfCookie(req, res) {
  res.clearCookie(CSRF_COOKIE_NAME, getCookieOptions(req, false));
}

function getOrIssueCsrfToken(req, res) {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (existing) {
    return existing;
  }

  if (!hasValidAuthToken(req)) {
    return null;
  }

  return issueCsrfCookie(req, res);
}

function hasValidAuthToken(req) {
  const token = req.cookies?.token;
  if (!token) {
    return false;
  }

  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (error) {
    return false;
  }
}

function csrfProtection(req, res, next) {
  const method = (req.method || 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return next();
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  // Require CSRF only for requests with a valid authenticated cookie.
  // This keeps public endpoints and stale/invalid tokens from blocking login.
  if (!hasValidAuthToken(req)) {
    return next();
  }

  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const csrfHeader = req.get(CSRF_HEADER_NAME);

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  return next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  issueCsrfCookie,
  ensureCsrfCookie,
  clearCsrfCookie,
  getOrIssueCsrfToken,
  csrfProtection
};
