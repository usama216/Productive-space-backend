require('dotenv').config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Import scheduled cleanup (this will start the cron job)
const { cleanupUnpaidBookings } = require('./scheduledCleanup');
const { startCreditCleanup } = require('./scheduledCreditCleanup');

// Import automatic student expiry check (this will start the cron job)
const { cronJob: studentExpiryCronJob } = require('./automaticExpiryCheck');

// Import authentication middleware
const { authenticateUser, requireAdmin, requireOwnershipOrAdmin } = require('./middleware/auth');

// Import error handler middleware
const { errorHandler, sanitizeErrorMessage } = require('./middleware/errorHandler');

// Import rate limiting middleware
const { 
  generalLimiter, 
  authLimiter, 
  sensitiveOperationLimiter, 
  adminLimiter,
  userLimiter,
  publicLimiter 
} = require('./middleware/rateLimiter');

// Start cleanup schedulers
startCreditCleanup();

const app = express();

// Security Headers - Apply Helmet middleware for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger UI
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts for Swagger UI
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Swagger UI compatibility
}));

// CORS Configuration - Dynamic CORS based on endpoint type
// Public endpoints: Allow all origins (*)
// Protected endpoints: Only allow trusted origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://productive-space.vercel.app',
      'https://my-productive-space.vercel.app',
      'https://www.productivespace.sg'
    ];

// Import dynamic CORS middleware
const { dynamicCors } = require('./middleware/dynamicCors');

// Apply dynamic CORS middleware
app.use(dynamicCors(allowedOrigins));

// Apply general rate limiting to all routes
// Specific routes can override with their own limiters
app.use('/api', generalLimiter);

// Middleware to capture raw body for webhook signature verification
// Must capture raw body before express.json() parses it
// HitPay webhooks can come to multiple endpoints
const isWebhookRoute = (path) => {
  return path === '/api/hitpay/webhook' || 
         path === '/api/packages/webhook' ||
         path.endsWith('/webhook'); // Catch any webhook route
};

app.use((req, res, next) => {
  if (isWebhookRoute(req.path) && req.method === 'POST') {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      req.rawBody = data;
      // Try to parse as JSON first, if that fails, keep as raw string for form-encoded parsing
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        // If not JSON, it's likely form-encoded - keep rawBody for verification
        // The urlencoded middleware will parse it later
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});

// Apply JSON parsing for non-webhook routes with size limits
app.use((req, res, next) => {
  if (isWebhookRoute(req.path) && req.method === 'POST') {
    return next(); // Skip JSON parsing for webhook routes (raw body already captured)
  }
  express.json({ limit: '10mb' })(req, res, next);
});

// Apply urlencoded parsing for non-webhook routes with size limits
// Webhook routes handle parsing in verification middleware
app.use((req, res, next) => {
  if (isWebhookRoute(req.path) && req.method === 'POST') {
    return next(); // Skip urlencoded parsing for webhook routes
  }
  express.urlencoded({ extended: true, limit: '1mb' })(req, res, next);
});

// Allowed MIME types for file uploads (strict whitelist)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png'
];

/**
 * Sanitize filename to prevent path traversal attacks
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove path traversal sequences
  let sanitized = filename.replace(/\.\./g, '');
  // Remove directory separators
  sanitized = sanitized.replace(/[\/\\]/g, '');
  // Remove special characters that could be dangerous
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
  // Limit length
  sanitized = sanitized.substring(0, 255);
  return sanitized || 'file';
}

/**
 * Check file magic bytes to verify actual file type (FILE-001 Fix)
 * @param {Buffer} buffer - File buffer
 * @returns {string|null} - Detected MIME type or null if invalid
 */
function checkMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null;
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  
  return null;
}

// FILE-001 Fix: Use memoryStorage to validate magic bytes before saving to disk
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow single file uploads
  },
  fileFilter: function (req, file, cb) {
    // Strict MIME type validation using whitelist
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG image files are allowed for student verification'), false);
    }
  }
})

// Middleware to validate magic bytes and save to disk (FILE-001 Fix)
const validateAndSaveFile = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Validate magic bytes match declared MIME type
    const detectedType = checkMagicBytes(req.file.buffer);
    
    if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'File signature does not match declared type. Only JPEG and PNG images are allowed.'
      });
    }

    // Ensure uploads directory exists
    const uploadsDir = 'uploads/';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate safe filename
    const sanitizedOriginal = sanitizeFilename(req.file.originalname);
    const ext = path.extname(sanitizedOriginal) || (detectedType === 'image/png' ? '.png' : '.jpg');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${req.file.fieldname}-${uniqueSuffix}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Save file to disk
    fs.writeFileSync(filepath, req.file.buffer);

    // Update req.file to match diskStorage behavior
    req.file.filename = filename;
    req.file.path = filepath;
    req.file.destination = uploadsDir;

    next();
  } catch (error) {
    console.error('Error validating and saving file:', error);
    return res.status(500).json({
      error: 'File upload failed',
      message: 'Failed to process uploaded file'
    });
  }
};

// Import routes after environment variables are loaded
const paymentRoutes = require("./routes/payment");
const bookingRoutes = require("./routes/booking");
const promoCodeRoutes = require("./routes/promoCode");
const studentVerificationRoutes = require("./routes/studentVerification");
const packageRoutes = require("./routes/packages");
const newPackageRoutes = require("./routes/newPackages");
const packagePaymentRoutes = require("./routes/packagePayment");
const packageUsageRoutes = require("./routes/packageUsage");
const adminPackageRoutes = require("./routes/adminPackages");
const adminPackageUsageRoutes = require("./routes/adminPackageUsage");
const simpleTestRoutes = require("./routes/simpleTest");
const refundRoutes = require("./routes/refund");
const adminRefundRoutes = require("./routes/adminRefund");
const creditRoutes = require("./routes/credit");
const pricingRoutes = require("./routes/pricing");
const rescheduleRoutes = require("./routes/reschedule");
const doorRoutes = require("./routes/door");
const discountHistoryRoutes = require("./routes/discountHistory");
const tuyaSettingsRoutes = require("./routes/tuyaSettings");
const bookingActivityRoutes = require("./routes/bookingActivity");
const paymentSettingsRoutes = require("./routes/paymentSettings");
const announcementRoutes = require("./routes/announcement");
const adminUserRoutes = require('./routes/adminUser');
const shopHoursRoutes = require('./routes/shopHours');
const { swaggerUi, specs } = require('./swagger');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get("/", (req, res) => {
  res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Productive Space Backend</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    max-width: 800px;
                    margin: 50px auto;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .container {
                    background-color: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                }
                h1 {
                    color: #333;
                    margin-bottom: 20px;
                }
                .status {
                    color: #28a745;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .timestamp {
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 30px;
                }
              
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Welcome to the Productive Space Backend!</h1>
                <div class="status">Status: Running Successfully</div>
            </div>
        </body>
        </html>
    `);
});
// Rate Limiting Strategy:
// - generalLimiter: Applied globally to all /api routes (default fallback)
// - publicLimiter: Public read endpoints (packages, pricing, announcements, shop-hours, payment-settings)
// - sensitiveOperationLimiter: Sensitive operations (payments, bookings, refunds, credits, reschedules)
// - userLimiter: User-specific endpoints (user bookings, discount history, booking activity)
// - adminLimiter: Admin-only endpoints
// - authLimiter: Authentication endpoints (if any)

// Door routes - sensitive operation (door unlock)
app.use("/api/door", sensitiveOperationLimiter, doorRoutes);
// Public door unlock endpoint - clean URL without exposing internal API structure
// Apply public rate limiting (more permissive) - door unlock uses token-based auth
app.get("/open", publicLimiter, require('./controllers/doorController').openDoor);

// Payment routes - sensitive operation (payment creation)
app.use("/api/hitpay", sensitiveOperationLimiter, paymentRoutes);

// Booking routes - sensitive operation (booking creation, modification)
app.use("/api/booking", sensitiveOperationLimiter, bookingRoutes);

// Promo code routes - public read, sensitive write
app.use("/api/promocode", promoCodeRoutes); // Uses generalLimiter, specific routes can override

// Student verification routes - sensitive operation
app.use("/api/student", sensitiveOperationLimiter, studentVerificationRoutes);

// Package routes - public read, sensitive write
app.use("/api/packages", packageRoutes); // Uses generalLimiter, specific routes can override
app.use("/api/packages", sensitiveOperationLimiter, packagePaymentRoutes);
app.use("/api/new-packages", newPackageRoutes); // Uses generalLimiter, specific routes can override
app.use("/api/packages", userLimiter, packageUsageRoutes); // User-specific

// Admin package routes
app.use("/api/admin/packages", adminLimiter, adminPackageUsageRoutes);
app.use("/api/admin/packages", adminLimiter, adminPackageRoutes);

// Test routes - admin-only
app.use("/api/test", adminLimiter, simpleTestRoutes);

// Refund routes - sensitive operation
app.use("/api/refund", sensitiveOperationLimiter, refundRoutes);
app.use("/api/admin/refund", adminLimiter, adminRefundRoutes);

// Credit routes - sensitive operation
app.use("/api/credit", sensitiveOperationLimiter, creditRoutes);

// Pricing routes - public read
app.use("/api", publicLimiter, pricingRoutes);

// Reschedule routes - sensitive operation
app.use("/api/reschedule", sensitiveOperationLimiter, rescheduleRoutes);

// Discount history routes - user-specific
app.use("/api/discount-history", userLimiter, discountHistoryRoutes);

// Tuya settings routes - admin-only
app.use("/api/tuya-settings", adminLimiter, tuyaSettingsRoutes);

// Booking activity routes - user-specific
app.use("/api/booking-activity", userLimiter, bookingActivityRoutes);

// Payment settings routes - public read
app.use("/api/payment-settings", publicLimiter, paymentSettingsRoutes);

// Announcement routes - public read
app.use("/api", publicLimiter, announcementRoutes);

// Admin user routes - admin-only
app.use("/api", adminLimiter, adminUserRoutes);

// Shop hours routes - public read
app.use("/api/shop-hours", publicLimiter, shopHoursRoutes);

// Package application routes - sensitive operation
app.use("/api/booking", sensitiveOperationLimiter, require('./routes/packageApplication'));
app.post('/api/test-package-usage', adminLimiter, authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { handlePackageUsage } = require('./utils/packageUsageHelper');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data: userPasses, error: checkError } = await supabase
      .from('UserPass')
      .select('*')
      .eq('packagepurchaseid', req.body.packageId);


    if (userPasses && userPasses.length > 0) {
      const testPass = userPasses[0];

      const { error: testError } = await supabase
        .from('UserPass')
        .update({ remainingCount: testPass.remainingCount - 1 })
        .eq('id', testPass.id);

    }

    const result = await handlePackageUsage(
      req.body.userId,
      req.body.packageId,
      req.body.hoursUsed || 5,
      req.body.bookingId || `test-${Date.now()}`,
      req.body.location || 'Kovan',
      req.body.startTime || new Date().toISOString(),
      req.body.endTime || new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
    );

    res.json({ success: true, result, userPasses });
  } catch (error) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      success: false, 
      error: isDevelopment ? error.message : 'An error occurred during package usage test'
    });
  }
});

// Test verification tracking endpoint
app.get('/api/test-verification-tracking/:userId', adminLimiter, authenticateUser, requireOwnershipOrAdmin('userId'), async (req, res) => {
  try {
    const { sanitizeUUID } = require('./utils/inputSanitizer');
    const { userId } = req.params;

    const sanitizedUserId = sanitizeUUID(userId);
    if (!sanitizedUserId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    console.log('🧪 Test verification tracking for user:', sanitizedUserId);

    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', sanitizedUserId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        studentVerificationStatus: user.studentVerificationStatus,
        studentVerificationDate: user.studentVerificationDate,
        studentRejectionReason: user.studentRejectionReason,
        updatedAt: user.updatedAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Test verification tracking error:', error);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
      success: false,
      error: isDevelopment ? error.message : 'An error occurred while fetching verification tracking'
    });
  }
});

// Get verification history for a user
app.get('/api/verification-history/:userId', userLimiter, authenticateUser, requireOwnershipOrAdmin('userId'), async (req, res) => {
  try {
    const { sanitizeUUID } = require('./utils/inputSanitizer');
    const { userId } = req.params;

    // Sanitize userId to prevent injection
    const sanitizedUserId = sanitizeUUID(userId);
    if (!sanitizedUserId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID format'
      });
    }

    console.log('📋 Getting verification history for user:', sanitizedUserId);

    const { data: history, error } = await supabase
      .from('VerificationHistory')
      .select('*')
      .eq('userId', sanitizedUserId)
      .order('changedAt', { ascending: false }); // Most recent first

    if (error) {
      console.error('Error fetching verification history:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch verification history'
      });
    }

    res.json({
      success: true,
      history: history || []
    });
  } catch (error) {
    console.error('Verification history error:', error);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
      success: false,
      error: isDevelopment ? error.message : 'An error occurred while fetching verification history'
    });
  }
});

app.post('/api/cleanup-unpaid-bookings', adminLimiter, authenticateUser, requireAdmin, async (req, res) => {
  try {
    await cleanupUnpaidBookings();
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({ 
      error: 'Cleanup failed',
      ...(isDevelopment && { details: error.message })
    });
  }
});

// Swagger Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Productive Space API Documentation"
}));


// Note: /users route removed - use authenticated routes instead
// Use /api/admin/users with admin authentication

app.get("/api/user/:userId", authenticateUser, requireOwnershipOrAdmin('userId'), async (req, res) => {
  try {
    const { sanitizeUUID } = require('./utils/inputSanitizer');
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
        message: "Please provide a valid user ID"
      });
    }

    const sanitizedUserId = sanitizeUUID(userId);
    if (!sanitizedUserId) {
      return res.status(400).json({
        error: "Invalid user ID format",
        message: "Please provide a valid user ID"
      });
    }

    const { data: user, error } = await supabase
      .from("User")
      .select(`
                id,
                email,
                firstName,
                lastName,
                memberType,
                contactNumber,
                createdAt,
                updatedAt,
                studentVerificationImageUrl,
                studentVerificationDate,
                studentRejectionReason,
                studentVerificationStatus
            `)
      .eq("id", sanitizedUserId)
      .single();

    if (error) {
      console.error('Get user profile error:', error);
      const isDevelopment = process.env.NODE_ENV === 'development';
      return res.status(500).json({
        error: "Failed to fetch user profile",
        ...(isDevelopment && { details: error.message })
      });
    }

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "The specified user does not exist"
      });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (err) {
    console.error('Get user profile error:', err);
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
      error: "Internal server error",
      ...(isDevelopment && { details: err.message })
    });
  }
});


app.put("/api/user/:userId", authenticateUser, requireOwnershipOrAdmin('userId'), upload.single('studentVerificationFile'), validateAndSaveFile, async (req, res) => {
  try {
    const { sanitizeUUID } = require('./utils/inputSanitizer');
    const { userId } = req.params;
    
    // Sanitize userId to prevent injection
    const sanitizedUserId = sanitizeUUID(userId);
    if (!sanitizedUserId) {
      return res.status(400).json({
        error: "Invalid user ID format",
        message: "Please provide a valid user ID"
      });
    }
    const {
      firstName,
      lastName,
      contactNumber,
      memberType,
      updatedAt
    } = req.body;

    const { data: existingUser, error: userError } = await supabase
      .from("User")
      .select("id")
      .eq("id", sanitizedUserId)
      .single();

    if (userError || !existingUser) {
      return res.status(404).json({
        error: "User not found",
        message: "The specified user does not exist"
      });
    }

    const updateData = {
      updatedAt: updatedAt || new Date().toISOString()
    };

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
    
    // Prevent users from changing their own memberType (LOGIC-001 Fix)
    if (memberType !== undefined) {
      // Only admins can change memberType
      if (req.user.memberType !== 'ADMIN') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You cannot change your own member type. Only administrators can change user roles.'
        });
      }
      // Prevent admins from promoting themselves
      if (req.user.id === sanitizedUserId && memberType === 'ADMIN') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You cannot promote yourself to admin'
        });
      }
      updateData.memberType = memberType;
    }

    if (req.file) {
      updateData.studentVerificationImageUrl = `/uploads/${req.file.filename}`;
      updateData.studentVerificationDate = new Date().toISOString();
      updateData.studentVerificationStatus = 'PENDING';
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("User")
      .update(updateData)
      .eq("id", sanitizedUserId)
      .select(`
                id,
                email,
                firstName,
                lastName,
                memberType,
                contactNumber,
                createdAt,
                updatedAt,
                studentVerificationImageUrl,
                studentVerificationDate,
                studentRejectionReason,
                studentVerificationStatus
            `)
      .single();

    if (updateError) {
      const isDevelopment = process.env.NODE_ENV === 'development';
      return res.status(500).json({
        error: "Failed to update user profile",
        ...(isDevelopment && { details: updateError.message })
      });
    }

    res.json({
      success: true,
      message: "User profile updated successfully",
      user: updatedUser
    });

  } catch (err) {
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(500).json({
      error: "Internal server error",
      ...(isDevelopment && { details: err.message })
    });
  }
});

// Global error handler - MUST be last middleware
app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
