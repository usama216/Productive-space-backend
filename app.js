require('dotenv').config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// Import scheduled cleanup
const { cleanupUnpaidBookings } = require('./scheduledCleanup');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop())
  }
})

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow only image files for student verification
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed for student verification'), false)
    }
  }
})

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

// Swagger documentation setup
const { swaggerUi, specs } = require('./swagger');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Welcome route - test API endpoint
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
                <div class="timestamp">Server Time: ${new Date().toLocaleString()}</div>
            </div>
        </body>
        </html>
    `);
});

app.use("/api/hitpay", paymentRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/promocode", promoCodeRoutes);
app.use("/api/student", studentVerificationRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/packages", packagePaymentRoutes);
app.use("/api/new-packages", newPackageRoutes);
app.use("/api/packages", packageUsageRoutes);
app.use("/api/admin/packages", adminPackageUsageRoutes);
app.use("/api/admin/packages", adminPackageRoutes);
app.use("/api/test", simpleTestRoutes);
app.use("/api/booking", require('./routes/packageApplication'));

// Manual cleanup endpoint for testing
app.post('/api/cleanup-unpaid-bookings', async (req, res) => {
  try {
    await cleanupUnpaidBookings();
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
  }
});

// Swagger API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Productive Space API Documentation"
}));

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all users (admin only)
app.get("/users", async (req, res) => {
    const { data, error } = await supabase.from("User").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

/**
 * @swagger
 * /api/user/{userId}:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request - User ID required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get single user profile by ID (for profile settings)
app.get("/api/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({ 
                error: "User ID is required",
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
            .eq("id", userId)
            .single();

        if (error) {
            console.error('Get user profile error:', error);
            return res.status(500).json({ 
                error: "Failed to fetch user profile", 
                details: error.message 
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
        res.status(500).json({ 
            error: "Internal server error", 
            details: err.message 
        });
    }
});

/**
 * @swagger
 * /api/user/{userId}:
 *   put:
 *     summary: Update user profile by ID
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: User first name
 *               lastName:
 *                 type: string
 *                 description: User last name
 *               contactNumber:
 *                 type: string
 *                 description: User contact number
 *               memberType:
 *                 type: string
 *                 enum: [STUDENT, REGULAR]
 *                 description: Type of membership
 *               studentVerificationFile:
 *                 type: string
 *                 format: binary
 *                 description: Student verification image file
 *     responses:
 *       200:
 *         description: User profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Update user profile by ID (for profile settings)
app.put("/api/user/:userId", upload.single('studentVerificationFile'), async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            firstName, 
            lastName, 
            contactNumber, 
            memberType, 
            updatedAt 
        } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                error: "User ID is required",
                message: "Please provide a valid user ID" 
            });
        }

        // Check if user exists
        const { data: existingUser, error: userError } = await supabase
            .from("User")
            .select("id")
            .eq("id", userId)
            .single();

        if (userError || !existingUser) {
            return res.status(404).json({ 
                error: "User not found",
                message: "The specified user does not exist" 
            });
        }

        // Prepare update data
        const updateData = {
            updatedAt: updatedAt || new Date().toISOString()
        };

        // Add fields only if they are provided
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
        if (memberType !== undefined) updateData.memberType = memberType;

        // Handle student verification file upload
        if (req.file) {
            // Store the file path in the database
            updateData.studentVerificationImageUrl = `/uploads/${req.file.filename}`;
            updateData.studentVerificationDate = new Date().toISOString();
            updateData.studentVerificationStatus = 'PENDING'; // Set to pending for admin review
        }

        // Update user in database
        const { data: updatedUser, error: updateError } = await supabase
            .from("User")
            .update(updateData)
            .eq("id", userId)
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
            console.error('Update user profile error:', updateError);
            return res.status(500).json({ 
                error: "Failed to update user profile", 
                details: updateError.message 
            });
        }

        res.json({
            success: true,
            message: "User profile updated successfully",
            user: updatedUser
        });

    } catch (err) {
        console.error('Update user profile error:', err);
        res.status(500).json({ 
            error: "Internal server error", 
            details: err.message 
        });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
