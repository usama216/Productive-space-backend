const axios = require("axios");
const { sendBookingConfirmation } = require("../utils/email");
const supabase = require("../config/database");

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
      bookingId, // Add this to link payment to booking
    } = req.body;

    // Validate required fields
    if (!amount || !currency || !email || !name || !purpose || !reference_number || !redirect_url || !bookingId) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["amount", "currency", "email", "name", "purpose", "reference_number", "redirect_url", "bookingId"]
      });
    }

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

    // Create payment request with HitPay
    const response = await hitpayClient.post("/v1/payment-requests", payload);
    
    // Create payment record in database
    const { data: paymentData, error: paymentError } = await supabase
      .from('Payment')
      .insert({
        id: require('crypto').randomUUID(),
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
        cost: parseFloat(amount),
        totalAmount: parseFloat(amount),
        paidAt: new Date().toISOString(),
        bookingRef: reference_number,
        paidBy: email,
        discountCode: null,
        paymentMethod: payment_methods[0] || "paynow_online", // Store the intended payment method
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment record creation error:", paymentError);
      console.error("Payment data attempted:", {
        id: require('crypto').randomUUID(),
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
        cost: parseFloat(amount),
        totalAmount: parseFloat(amount),
        paidAt: new Date().toISOString(),
        bookingRef: reference_number,
        paidBy: email,
        discountCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return res.status(500).json({ 
        error: "Failed to create payment record", 
        details: paymentError.message,
        code: paymentError.code 
      });
    }

    // Update booking table with paymentId and totalAmount
    const { error: bookingError } = await supabase
      .from('Booking')
      .update({
        paymentId: paymentData.id,
        totalAmount: parseFloat(amount),
        confirmedPayment: false // Will be updated to true when webhook confirms payment
      })
      .eq('id', bookingId);

    if (bookingError) {
      console.error("Booking update error:", bookingError);
      return res.status(500).json({ error: "Failed to update booking" });
    }

    // Return HitPay response with additional payment info
    res.json({
      ...response.data,
      paymentId: paymentData.id,
      bookingId: bookingId,
      message: "Payment request created and booking updated successfully"
    });

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

    // If payment is completed, update the database
    if (event.status === 'completed') {
      // Update payment record
      const { error: paymentUpdateError } = await supabase
        .from('Payment')
        .update({
          paidAt: new Date(),
          paymentMethod: event.payment_method || paymentDetails?.payment_methods?.[0] || "Online",
          updatedAt: new Date()
        })
        .eq('bookingRef', event.reference_number);

      if (paymentUpdateError) {
        console.error("Payment update error:", paymentUpdateError);
      }

      // Update booking to confirm payment
      const { error: bookingUpdateError } = await supabase
        .from('Booking')
        .update({
          confirmedPayment: true,
          updatedAt: new Date()
        })
        .eq('bookingRef', event.reference_number);

      if (bookingUpdateError) {
        console.error("Booking update error:", bookingUpdateError);
      }
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