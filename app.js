require('dotenv').config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

// Import scheduled cleanup (this will start the cron job)
const { cleanupUnpaidBookings } = require('./scheduledCleanup');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/') 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop())
  }
})

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
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
app.post('/api/test-package-usage', async (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test verification tracking endpoint
app.get('/api/test-verification-tracking/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🧪 Test verification tracking for user:', userId);
    
    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get verification history for a user
app.get('/api/verification-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('📋 Getting verification history for user:', userId);
    
    const { data: history, error } = await supabase
      .from('VerificationHistory')
      .select('*')
      .eq('userId', userId)
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/cleanup-unpaid-bookings', async (req, res) => {
  try {
    await cleanupUnpaidBookings();
    res.json({ success: true, message: 'Cleanup completed' });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
  }
});

// Swagger Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Productive Space API Documentation"
}));


app.get("/users", async (req, res) => {
    const { data, error } = await supabase.from("User").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

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

        const updateData = {
            updatedAt: updatedAt || new Date().toISOString()
        };

        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
        if (memberType !== undefined) updateData.memberType = memberType;

        if (req.file) {
            updateData.studentVerificationImageUrl = `/uploads/${req.file.filename}`;
            updateData.studentVerificationDate = new Date().toISOString();
            updateData.studentVerificationStatus = 'PENDING'; 
        }

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
        res.status(500).json({ 
            error: "Internal server error", 
            details: err.message 
        });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
