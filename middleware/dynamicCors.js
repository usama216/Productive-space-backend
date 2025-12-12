/**
 * Dynamic CORS Middleware
 * 
 * Public endpoints: Allow all origins (*)
 * Protected endpoints: Only allow trusted origins from allowedOrigins list
 */

const cors = require('cors');

// Define public endpoint patterns (routes that don't require authentication)
const publicEndpointPatterns = [
  // Public API endpoints
  /^\/api\/packages\/?$/,                          // GET /api/packages
  /^\/api\/packages\/[^\/]+$/,                     // GET /api/packages/:id
  /^\/api\/new-packages\/role\/[^\/]+$/,           // GET /api/new-packages/role/:role
  /^\/api\/new-packages\/[^\/]+$/,                 // GET /api/new-packages/:id
  /^\/api\/booking\/getById\/[^\/]+$/,            // GET /api/booking/getById/:id
  /^\/api\/booking\/getBookedSeats$/,             // POST /api/booking/getBookedSeats
  // /api/booking/:id is public but we need to avoid matching protected routes like /create, /admin, etc.
  // Match UUID pattern: 8-4-4-4-12 hex digits
  /^\/api\/booking\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^\/api\/announcements$/,                        // GET /api/announcements
  /^\/api\/payment-settings\/?$/,                  // GET /api/payment-settings
  /^\/api\/payment-settings\/[^\/]+$/,             // GET /api/payment-settings/:key
  /^\/api\/payment-settings\/calculate-fee$/,     // POST /api/payment-settings/calculate-fee
  /^\/api\/shop-hours\/operating\/[^\/]+$/,        // GET /api/shop-hours/operating/:location
  /^\/api\/shop-hours\/closures\/[^\/]+$/,        // GET /api/shop-hours/closures/:location
  /^\/api\/shop-hours\/check-availability$/,      // POST /api/shop-hours/check-availability
  /^\/api\/pricing\/[^\/]+$/,                      // GET /api/pricing/:location
  /^\/api\/pricing\/[^\/]+\/[^\/]+$/,              // GET /api/pricing/:location/:memberType
  /^\/api\/pricing$/,                              // GET /api/pricing
  /^\/open$/,                                      // GET /open (door unlock)
  /^\/$/,                                          // GET / (health check)
  /^\/docs/,                                       // Swagger docs
];

/**
 * Check if an endpoint is public (doesn't require authentication)
 * @param {string} path - Request path
 * @returns {boolean} True if public endpoint
 */
const isPublicEndpoint = (path) => {
  // Remove query strings for pattern matching
  const pathWithoutQuery = path.split('?')[0];
  
  return publicEndpointPatterns.some(pattern => pattern.test(pathWithoutQuery));
};

/**
 * Dynamic CORS middleware that checks route type
 * Public endpoints: Allow all origins
 * Protected endpoints: Only allow trusted origins
 * 
 * @param {string[]} allowedOrigins - Array of trusted origins for protected endpoints
 * @returns {Function} Express middleware function
 */
const dynamicCors = (allowedOrigins) => {
  return (req, res, next) => {
    const path = req.path;
    const isPublic = isPublicEndpoint(path);

    // Public endpoints: Allow all origins
    if (isPublic) {
      return cors({
        origin: true, // Allow all origins
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['Content-Range', 'X-Content-Range'],
        maxAge: 86400
      })(req, res, next);
    }

    // Protected endpoints: Only allow trusted origins
    return cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (Postman, mobile apps, curl, server-to-server)
        // This is needed for webhooks and server-side requests
        if (!origin) {
          return callback(null, true);
        }
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          // Log blocked origin for security monitoring
          // console.warn(`🚫 CORS blocked origin: Not allowed by CORS policy for protected endpoint: ${path}`);
          callback(new Error('Not allowed by CORS policy'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      maxAge: 86400
    })(req, res, next);
  };
};

module.exports = {
  dynamicCors,
  isPublicEndpoint
};

