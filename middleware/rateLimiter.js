/**
 * Rate Limiting Middleware
 * Protects API endpoints from brute force attacks, DDoS, and abuse
 * 
 * Note: Rate limiting is disabled in development mode (NODE_ENV=development)
 * 
 * Configuration via Environment Variables:
 * - RATE_LIMIT_GENERAL_WINDOW_MS: Time window for general limiter (default: 900000 = 15 minutes)
 * - RATE_LIMIT_GENERAL_MAX: Max requests per window for general limiter (default: 100)
 * - RATE_LIMIT_AUTH_WINDOW_MS: Time window for auth limiter (default: 900000 = 15 minutes)
 * - RATE_LIMIT_AUTH_MAX: Max requests per window for auth limiter (default: 5)
 * - RATE_LIMIT_SENSITIVE_WINDOW_MS: Time window for sensitive operations (default: 900000 = 15 minutes)
 * - RATE_LIMIT_SENSITIVE_MAX: Max requests per window for sensitive operations (default: 20)
 * - RATE_LIMIT_ADMIN_WINDOW_MS: Time window for admin limiter (default: 900000 = 15 minutes)
 * - RATE_LIMIT_ADMIN_MAX: Max requests per window for admin limiter (default: 200)
 * - RATE_LIMIT_USER_WINDOW_MS: Time window for user limiter (default: 900000 = 15 minutes)
 * - RATE_LIMIT_USER_MAX: Max requests per window for user limiter (default: 50)
 * - RATE_LIMIT_PUBLIC_WINDOW_MS: Time window for public limiter (default: 900000 = 15 minutes)
 * - RATE_LIMIT_PUBLIC_MAX: Max requests per window for public limiter (default: 200)
 */

const rateLimit = require('express-rate-limit');

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Parse environment variables with defaults
const parseEnvInt = (envVar, defaultValue) => {
  const value = process.env[envVar];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * General API rate limiter
 * Applied to all /api routes by default
 */
const generalLimiter = rateLimit({
  windowMs: parseEnvInt('RATE_LIMIT_GENERAL_WINDOW_MS', 15 * 60 * 1000), // Default: 15 minutes
  max: parseEnvInt('RATE_LIMIT_GENERAL_MAX', 10000), // Default: 100 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting in development or for webhooks (they use signature verification)
  skip: (req) => {
    return isDevelopment || req.path.includes('/webhook');
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: parseEnvInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000), // Default: 15 minutes
  max: parseEnvInt('RATE_LIMIT_AUTH_MAX', 5), // Default: 5 requests per window
  message: {
    success: false,
    error: 'Too many authentication attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: () => {
    return isDevelopment;
  },
  // Use IP address for tracking
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

/**
 * Moderate rate limiter for sensitive operations
 * For operations like payment, booking creation, refund, etc.
 */
const sensitiveOperationLimiter = rateLimit({
  windowMs: parseEnvInt('RATE_LIMIT_SENSITIVE_WINDOW_MS', 15 * 60 * 1000), // Default: 15 minutes
  max: parseEnvInt('RATE_LIMIT_SENSITIVE_MAX', 2000), // Default: 20 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests for this operation, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: () => {
    return isDevelopment;
  }
});

/**
 * Admin rate limiter
 * Higher limit for admin operations
 */
const adminLimiter = rateLimit({
  windowMs: parseEnvInt('RATE_LIMIT_ADMIN_WINDOW_MS', 15 * 60 * 1000), // Default: 15 minutes
  max: parseEnvInt('RATE_LIMIT_ADMIN_MAX', 20000), // Default: 200 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many admin requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: () => {
    return isDevelopment;
  }
});

/**
 * User-specific rate limiter
 * Uses authenticated user ID instead of IP
 */
const userLimiter = rateLimit({
  windowMs: parseEnvInt('RATE_LIMIT_USER_WINDOW_MS', 15 * 60 * 1000), // Default: 15 minutes
  max: parseEnvInt('RATE_LIMIT_USER_MAX', 5000), // Default: 50 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from your account, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for tracking if authenticated, otherwise fall back to IP
  keyGenerator: (req) => {
    return req.user?.id || req.ip || req.connection.remoteAddress;
  },
  // Skip in development or if user is admin
  skip: (req) => {
    return isDevelopment || req.user?.memberType === 'ADMIN';
  }
});

/**
 * Public endpoint rate limiter
 * More permissive for public endpoints
 */
const publicLimiter = rateLimit({
  windowMs: parseEnvInt('RATE_LIMIT_PUBLIC_WINDOW_MS', 15 * 60 * 1000), // Default: 15 minutes
  max: parseEnvInt('RATE_LIMIT_PUBLIC_MAX', 20000), // Default: 200 requests per window
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: () => {
    return isDevelopment;
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveOperationLimiter,
  adminLimiter,
  userLimiter,
  publicLimiter
};
