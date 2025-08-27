require('dotenv').config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const paymentRoutes = require("./routes/payment");
const bookingRoutes = require("./routes/booking");
const promoCodeRoutes = require("./routes/promoCode");



const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
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
                .endpoints {
                    text-align: left;
                    background-color: #f8f9fa;
                    padding: 20px;
                    border-radius: 5px;
                }
                .endpoints h3 {
                    color: #495057;
                    margin-top: 0;
                }
                .endpoint {
                    margin: 10px 0;
                    padding: 8px;
                    background-color: white;
                    border-left: 4px solid #007bff;
                    border-radius: 3px;
                }
                .endpoint.promo {
                    border-left: 4px solid #28a745;
                }
                .endpoint.admin {
                    border-left: 4px solid #dc3545;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Welcome to the Productive Space Backend!</h1>
                <div class="status">Status: Running Successfully</div>
                <div class="timestamp">Server Time: ${new Date().toLocaleString()}</div>
                
                <div class="endpoints">
                    <h3>Available API Endpoints:</h3>
                    <div class="endpoint">
                        <strong>GET /</strong> - Welcome page (this page)
                    </div>
                    <div class="endpoint">
                        <strong>GET /users</strong> - Get all users
                    </div>
                    <div class="endpoint">
                        <strong>POST /api/booking/create</strong> - Create new booking
                    </div>
                    <div class="endpoint">
                        <strong>GET /api/booking/all</strong> - Get all bookings
                    </div>
                    <div class="endpoint">
                        <strong>POST /api/hitpay/create-payment</strong> - Create payment request
                    </div>
                    
                    <h3 style="margin-top: 30px; color: #28a745;">🎫 Promo Code APIs (NEW!):</h3>
                    <div class="endpoint promo">
                        <strong>POST /api/promocode/apply</strong> - Apply promo code during booking
                    </div>
                    <div class="endpoint promo">
                        <strong>GET /api/promocode/user/:userId/available</strong> - Get user's available promo codes
                    </div>
                    <div class="endpoint promo">
                        <strong>GET /api/promocode/user/:userId/used</strong> - Get user's used promo codes
                    </div>
                    
                    <h3 style="margin-top: 30px; color: #dc3545;">🔧 Admin Promo Code APIs:</h3>
                    <div class="endpoint admin">
                        <strong>POST /api/promocode/admin/create</strong> - Create new promo code
                    </div>
                    <div class="endpoint admin">
                        <strong>PUT /api/promocode/admin/:id</strong> - Update promo code
                    </div>
                    <div class="endpoint admin">
                        <strong>DELETE /api/promocode/admin/:id</strong> - Delete promo code
                    </div>
                    <div class="endpoint admin">
                        <strong>GET /api/promocode/admin/all</strong> - Get all promo codes with stats
                    </div>
                    <div class="endpoint admin">
                        <strong>GET /api/promocode/admin/:id</strong> - Get promo code details
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.use("/api/hitpay", paymentRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/promocode", promoCodeRoutes);

app.get("/users", async (req, res) => {
    const { data, error } = await supabase.from("User").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
