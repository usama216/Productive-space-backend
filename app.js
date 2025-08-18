require('dotenv').config();

const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const paymentRoutes = require("./routes/payment");
const bookingRoutes = require("./routes/booking");



const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Welcome route - test API endpoint
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to Productive Space Backend!",
        status: "success",
        timestamp: new Date().toISOString(),
        endpoints: {
            welcome: "GET /",
            users: "GET /users",
            payment: "POST /api/hitpay",
            booking: "POST /api/booking"
        }
    });
});

app.use("/api/hitpay", paymentRoutes);
app.use("/api/booking", bookingRoutes);

app.get("/users", async (req, res) => {
    const { data, error } = await supabase.from("User").select("*");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});
