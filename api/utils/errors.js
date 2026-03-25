/**
 * Standardized error response utility
 * Ensures consistent error format across all API endpoints
 */

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Optional additional error details
 */
function sendError(res, statusCode, message, details = null) {
  const response = {
    error: message
  };
  
  // Add details in development mode
  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }
  
  // Add error message in development mode
  if (process.env.NODE_ENV === 'development' && details?.stack) {
    response.stack = details.stack;
  }
  
  return res.status(statusCode).json(response);
}

/**
 * Handle database errors and return appropriate HTTP status
 */
function handleDatabaseError(res, error) {
  console.error('Database error:', error);
  
  // PostgreSQL error codes
  if (error.code === '23505') { // Unique violation
    return sendError(res, 400, 'Duplicate entry. This record already exists.');
  }
  if (error.code === '23503') { // Foreign key violation
    return sendError(res, 400, 'Invalid reference. Related record does not exist.');
  }
  if (error.code === '23502') { // Not null violation
    return sendError(res, 400, 'Missing required field.');
  }
  if (error.code === '42P01') { // Undefined table
    return sendError(res, 500, 'Database table not found. Please check database setup.');
  }
  if (error.code === '42703') { // Undefined column
    return sendError(res, 500, 'Database column not found. Please run migrations.');
  }
  
  // Connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.isConnectionError) {
    console.error('Database connection error detected:', {
      code: error.code,
      message: error.message,
      isConnectionError: error.isConnectionError
    });
    return sendError(res, 503, 'Database connection unavailable. Please try again later.', {
      error: 'Database service is temporarily unavailable',
      retryAfter: 30 // Suggest retrying after 30 seconds
    });
  }
  
  // Query timeout
  if (error.code === 'ETIMEDOUT' || (error.message && error.message.includes('timeout'))) {
    console.error('Database query timeout:', {
      message: error.message,
      code: error.code
    });
    return sendError(res, 504, 'Request timeout. The database query took too long.');
  }
  
  // Generic database error
  return sendError(res, 500, 'Database error occurred.', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
}

/**
 * Handle validation errors
 */
function handleValidationError(res, message, field = null) {
  const response = {
    error: message
  };
  
  if (field) {
    response.field = field;
  }
  
  return res.status(400).json(response);
}

/**
 * Handle authentication errors
 */
function handleAuthError(res, message = 'Authentication required') {
  return sendError(res, 401, message);
}

/**
 * Handle authorization errors
 */
function handleAuthzError(res, message = 'Insufficient permissions') {
  return sendError(res, 403, message);
}

/**
 * Handle not found errors
 */
function handleNotFoundError(res, resource = 'Resource') {
  return sendError(res, 404, `${resource} not found`);
}

/**
 * Handle generic server errors
 * Automatically detects database errors and routes to handleDatabaseError
 */
function handleServerError(res, error, context = '') {
  console.error(`Server error${context ? ` in ${context}` : ''}:`, error);
  
  // Check if it's a database error first
  if (error.code || error.isConnectionError) {
    return handleDatabaseError(res, error);
  }
  
  return sendError(res, 500, 'An internal server error occurred.', {
    message: error.message,
    stack: error.stack
  });
}

/**
 * Handle client errors (validation, bad request, etc.)
 */
function handleClientError(res, message, statusCode = 400, details = null) {
  return sendError(res, statusCode, message, details);
}

module.exports = {
  sendError,
  handleDatabaseError,
  handleValidationError,
  handleAuthError,
  handleAuthzError,
  handleNotFoundError,
  handleServerError,
  handleClientError
};


