require('dotenv').config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");



const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// Import routes after environment variables are loaded
const paymentRoutes = require("./routes/payment");
const bookingRoutes = require("./routes/booking");
const promoCodeRoutes = require("./routes/promoCode");
const studentVerificationRoutes = require("./routes/studentVerification");
const packageRoutes = require("./routes/packages");
const enhancedPromoRoutes = require("./routes/enhancedPromoCode");
const enhancedPromoAdminRoutes = require("./routes/enhancedPromoCodeAdmin");

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
app.use("/api/enhanced-promo", enhancedPromoRoutes);
app.use("/api/enhanced-promo-admin", enhancedPromoAdminRoutes);

// Get all users (admin only)
app.get("/users", async (req, res) => {
    const { data, error } = await supabase.from("User").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

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

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
