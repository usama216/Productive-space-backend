const axios = require("axios");
const { sendBookingConfirmation } = require("../utils/email");

const hitpayClient = axios.create({
  baseURL: process.env.HITPAY_API_URL,
  headers: {
    "X-BUSINESS-API-KEY": process.env.HITPAY_API_KEY,
    "Content-Type": "application/json" 
  }
});

// console.log(process.env.HITPAY_API_URL);

exports.createPayment = async (req, res) => {
  try {
    const {
      amount,
      currency,
      email,
      name,
      purpose,
      reference_number,
      redirect_url,
      webhook,
      payment_methods = ["paynow_online"],
      phone,
      send_email = false,
      send_sms = false,
      allow_repeated_payments = false,
    } = req.body;

    const payload = {
      amount,
      currency,
      email,
      name,
      purpose,
      reference_number,
      redirect_url,
      webhook,
      payment_methods,
      phone,
      send_email,
      send_sms,
      allow_repeated_payments,
    };

    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    const response = await hitpayClient.post("/v1/payment-requests", payload);
    
    res.json(response.data);
  } catch (error) {
    console.error("HitPay createPayment error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data || error.message,
      details: error.response?.status ? `HTTP ${error.response.status}` : 'Network Error'
    });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    // console.log("Raw webhook body:", req.body);
    
    const event = req.body;
    
    let paymentDetails = null;
    try {
      const response = await hitpayClient.get(`/v1/payment-requests/${event.payment_request_id}`);
      paymentDetails = response.data;
      // console.log("Fetched payment details:", paymentDetails);
    } catch (apiError) {
      console.error("Failed to fetch payment details:", apiError.response?.data || apiError.message);
    }

    const userData = {
      name: paymentDetails?.name || event.customer_name || "Customer",
      email: paymentDetails?.email || event.customer_email
    };

    const bookingData = {
      reference_number: event.reference_number,
      amount: event.amount,
      location: paymentDetails?.purpose || event.location, 
      seats: [],
      payment_method: event.payment_method || paymentDetails?.payment_methods?.[0] || "Online",
      status: event.status,
      totalAmount: event.amount
    };

    // if (event.status === 'completed' && userData.email) {
    //   await sendBookingConfirmation(userData, bookingData);
    //   console.log("Confirmation email sent to:", userData.email);
    // } else {
    //   console.log("Email not sent - Status:", event.status, "Email:", userData.email);
    // }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    res.status(500).send("Internal Server Error");
  }
};