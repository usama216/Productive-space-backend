/**
 * Rate Limiting Middleware
 * Protects API endpoints from brute force attacks, DDoS, and abuse
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for webhooks (they use signature verification)
  skip: (req) => {
    return req.path.includes('/webhook');
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 65 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts',
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use IP address for tracking
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

/**
 * Moderate rate limiter for sensitive operations
 * 20 requests per 15 minutes per IP
 * For operations like payment, booking creation, etc.
 */
const sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests for this operation, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Admin rate limiter
 * 200 requests per 15 minutes per IP
 * Higher limit for admin operations
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many admin requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * User-specific rate limiter
 * Uses authenticated user ID instead of IP
 * 50 requests per 15 minutes per user
 */
const userLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 15 minutes
  max: 500, // Limit each user to 50 requests per windowMs
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
  // Skip if user is admin
  skip: (req) => {
    return req.user?.memberType === 'ADMIN';
  }
});

/**
 * Public endpoint rate limiter
 * More permissive for public endpoints
 * 200 requests per 15 minutes per IP
 */
const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 200 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveOperationLimiter,
  adminLimiter,
  userLimiter,
  publicLimiter
};

