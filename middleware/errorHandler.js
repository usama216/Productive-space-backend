/**
 * Global Error Handler Middleware
 * Prevents information disclosure in production by sanitizing error messages
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Sanitize error message to prevent information disclosure
 * @param {Error} error - The error object
 * @returns {string} - Sanitized error message
 */
function sanitizeErrorMessage(error) {
  if (isDevelopment) {
    // In development, show full error details
    return error.message || 'An error occurred';
  }

  // In production, return generic error messages
  // Don't expose internal error details, stack traces, or system information
  if (error.message) {
    // Check if it's a known safe error message (user-facing)
    const safeMessages = [
      'Invalid user ID format',
      'User not found',
      'Invalid request',
      'Unauthorized',
      'Forbidden',
      'Not found'
    ];

    if (safeMessages.some(msg => error.message.includes(msg))) {
      return error.message;
    }
  }

  // Generic error message for production
  return 'An internal server error occurred. Please try again later.';
}

/**
 * Global error handler middleware
 * Must be added after all routes
 */
function errorHandler(err, req, res, next) {
  // Log full error details server-side (for debugging)
  console.error('Error:', {
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send sanitized error response
  res.status(statusCode).json({
    success: false,
    error: sanitizeErrorMessage(err),
    ...(isDevelopment && { 
      details: err.message,
      stack: err.stack 
    })
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  asyncHandler,
  sanitizeErrorMessage
};

