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
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Event:", req.body);
    
    const event = req.body;
    
    let paymentDetails = null;
    try {
      const response = await hitpayClient.get(`/v1/payment-requests/${event.payment_request_id}`);
      paymentDetails = response.data;
      console.log("Payment details:", paymentDetails);
    } catch (apiError) {
      console.error("Failed to fetch payment details:", apiError.response?.data || apiError.message);
    }

    // Determine payment type based on reference number
    const isPackagePayment = event.reference_number.startsWith('PKG_');
    const isBookingPayment = event.reference_number.startsWith('ORD_') || event.reference_number.startsWith('BOOK_');

    console.log("Payment type detected:", {
      reference: event.reference_number,
      isPackagePayment,
      isBookingPayment
    });

    // If payment is completed, update the database
    if (event.status === 'completed') {
      if (isPackagePayment) {
        // Handle package payment completion
        await handlePackagePaymentCompletion(event, paymentDetails);
      } else if (isBookingPayment) {
        // Handle booking payment completion
        await handleBookingPaymentCompletion(event, paymentDetails);
      } else {
        console.log("Unknown payment type for reference:", event.reference_number);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    res.status(500).send("Internal Server Error");
  }
};

// Handle booking payment completion
async function handleBookingPaymentCompletion(event, paymentDetails) {
  try {
    console.log("Processing booking payment completion...");
    
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

    console.log("Booking payment completed successfully");
  } catch (error) {
    console.error("Error handling booking payment completion:", error);
  }
}

// Handle package payment completion
async function handlePackagePaymentCompletion(event, paymentDetails) {
  try {
    console.log("Processing package payment completion...");
    
    // Find package purchase by order ID
    const { data: packagePurchase, error: findError } = await supabase
      .from("PackagePurchase")
      .select(`
        *,
        Package (
          id,
          name,
          packagetype,
          targetrole,
          packagecontents,
          validitydays
        )
      `)
      .eq("orderid", event.reference_number)
      .single();

    if (findError || !packagePurchase) {
      console.error("Package purchase not found for order:", event.reference_number);
      return;
    }

    // Update package purchase to completed
    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentstatus: "COMPLETED",
        paymentmethod: event.payment_method || paymentDetails?.payment_methods?.[0] || "Online",
        hitpayreference: event.payment_request_id,
        activatedat: new Date().toISOString(),
        expiresat: new Date(Date.now() + (packagePurchase.Package.validitydays * 24 * 60 * 60 * 1000)).toISOString(),
        updatedat: new Date().toISOString()
      })
      .eq("id", packagePurchase.id);

    if (updateError) {
      console.error("Package purchase update error:", updateError);
      return;
    }

    // Create UserPass records based on package contents
    await createUserPasses(packagePurchase);

    console.log("Package payment completed successfully:", packagePurchase.id);
  } catch (error) {
    console.error("Error handling package payment completion:", error);
  }
}

// Helper function to create user passes (same as in packagePaymentController)
async function createUserPasses(packagePurchase) {
  try {
    const { v4: uuidv4 } = require("uuid");
    const packageContents = packagePurchase.Package.packagecontents;
    const userPasses = [];

    // Create half-day passes
    if (packageContents.halfDayPasses && packageContents.halfDayPasses > 0) {
      for (let i = 0; i < packageContents.halfDayPasses; i++) {
        userPasses.push({
          id: uuidv4(),
          packagepurchaseid: packagePurchase.id,
          passtype: "HALF_DAY",
          hours: packageContents.halfDayHours || 6,
          status: "ACTIVE",
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString()
        });
      }
    }

    // Create full-day passes
    if (packageContents.fullDayPasses && packageContents.fullDayPasses > 0) {
      for (let i = 0; i < packageContents.fullDayPasses; i++) {
        userPasses.push({
          id: uuidv4(),
          packagepurchaseid: packagePurchase.id,
          passtype: "FULL_DAY",
          hours: packageContents.fullDayHours || 12,
          status: "ACTIVE",
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString()
        });
      }
    }

    // Create semester passes (if applicable)
    if (packagePurchase.Package.packagetype === "SEMESTER_BUNDLE") {
      userPasses.push({
        id: uuidv4(),
        packagepurchaseid: packagePurchase.id,
        passtype: "SEMESTER",
        hours: packageContents.totalHours || 200,
        status: "ACTIVE",
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString()
      });
    }

    // Insert all user passes
    if (userPasses.length > 0) {
      const { error: insertError } = await supabase
        .from("UserPass")
        .insert(userPasses);

      if (insertError) {
        console.error("Error creating user passes:", insertError);
        throw insertError;
      }

      console.log(`Created ${userPasses.length} user passes for package purchase:`, packagePurchase.id);
    }

  } catch (error) {
    console.error("Error in createUserPasses:", error);
    throw error;
  }
}