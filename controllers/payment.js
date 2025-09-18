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
      bookingId, 
    } = req.body;

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

    const response = await hitpayClient.post("/v1/payment-requests", payload);
    
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
        paymentMethod: payment_methods[0] || "paynow_online",
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

    const { error: bookingError } = await supabase
      .from('Booking')
      .update({
        paymentId: paymentData.id,
        totalAmount: parseFloat(amount),
        confirmedPayment: false
      })
      .eq('id', bookingId);

    if (bookingError) {
      return res.status(500).json({ error: "Failed to update booking" });
    }

    res.json({
      ...response.data,
      paymentId: paymentData.id,
      bookingId: bookingId,
      message: "Payment request created and booking updated successfully"
    });

  } catch (error) {
    res.status(500).json({ 
      error: error.response?.data || error.message,
      details: error.response?.status ? `HTTP ${error.response.status}` : 'Network Error'
    });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const event = req.body;
    let paymentDetails = null;
    try {
      const response = await hitpayClient.get(`/v1/payment-requests/${event.payment_request_id}`);
      paymentDetails = response.data;
    } catch (apiError) {
      console.error("Failed to fetch payment details:", apiError.response?.data || apiError.message);
    }

    const isPackagePayment = event.reference_number.startsWith('PKG_');
    const isBookingPayment = event.reference_number.startsWith('ORD_') || event.reference_number.startsWith('BOOK_');

    if (event.status === 'completed') {
      if (isPackagePayment) {
        await handlePackagePaymentCompletion(event, paymentDetails);
      } else if (isBookingPayment) {
        await handleBookingPaymentCompletion(event, paymentDetails);
      } else {
        console.log("Unknown payment type for reference:", event.reference_number);
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

async function handleBookingPaymentCompletion(event, paymentDetails) {
  try {
   
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

    const { data: bookingData, error: bookingUpdateError } = await supabase
      .from('Booking')
      .update({
        confirmedPayment: true,
        updatedAt: new Date()
      })
      .eq('bookingRef', event.reference_number)
      .select()
      .single();

    if (bookingUpdateError) {
      console.error("Booking update error:", bookingUpdateError);
    }

    // Handle package usage if package was used
    if (bookingData && bookingData.packageId && bookingData.packageUsed) {
      try {
        console.log(`\n🎯 ===== PACKAGE USAGE ON WEBHOOK PAYMENT =====`);
        console.log(`📋 Booking ID: ${bookingData.id}`);
        console.log(`📋 User ID: ${bookingData.userId}`);
        console.log(`📋 Package ID: ${bookingData.packageId}`);

        // Calculate hours used from booking duration
        const startTime = new Date(bookingData.startAt);
        const endTime = new Date(bookingData.endAt);
        const hoursUsed = (endTime - startTime) / (1000 * 60 * 60);

        // Import the package usage helper
        const { handlePackageUsage } = require('../utils/packageUsageHelper');

        const packageUsageResult = await handlePackageUsage(
          bookingData.userId,
          bookingData.packageId,
          hoursUsed,
          bookingData.id,
          bookingData.location,
          bookingData.startAt,
          bookingData.endAt
        );

        if (packageUsageResult.success) {
          console.log(`✅ Package usage successful: ${packageUsageResult.passUsed}`);
        } else {
          console.error(`❌ Package usage failed: ${packageUsageResult.error}`);
        }
      } catch (packageError) {
        console.error(`❌ Package usage exception:`, packageError);
      }
    }

    console.log("Booking payment completed successfully");
  } catch (error) {
    console.error("Error handling booking payment completion:", error);
  }
}

async function handlePackagePaymentCompletion(event, paymentDetails) {
  try {
    
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
          validityDays
        )
      `)
      .eq("orderId", event.reference_number)
      .single();

    if (findError || !packagePurchase) {
      console.error("Package purchase not found for order:", event.reference_number);
      return;
    }

    const { error: updateError } = await supabase
      .from("PackagePurchase")
      .update({
        paymentStatus: "COMPLETED",
        paymentmethod: event.payment_method || paymentDetails?.payment_methods?.[0] || "Online",
        hitPayReference: event.payment_request_id,
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (packagePurchase.Package.validityDays * 24 * 60 * 60 * 1000)).toISOString(),
        updatedAt: new Date().toISOString()
      })
      .eq("id", packagePurchase.id);

    if (updateError) {
      console.error("Package purchase update error:", updateError);
      return;
    }

    await createUserPasses(packagePurchase);

    console.log("Package payment completed successfully:", packagePurchase.id);
  } catch (error) {
    console.error("Error handling package payment completion:", error);
  }
}

async function createUserPasses(packagePurchase) {
  try {
    const { v4: uuidv4 } = require("uuid");
    const packageContents = packagePurchase.Package.packagecontents;
    const userPasses = [];

    if (packageContents.halfDayPasses && packageContents.halfDayPasses > 0) {
      for (let i = 0; i < packageContents.halfDayPasses; i++) {
        userPasses.push({
          id: uuidv4(),
          packagePurchaseId: packagePurchase.id,
          userId: packagePurchase.userId,
          passType: "HALF_DAY",
          totalCount: 1,
          remainingCount: 1,
          status: "ACTIVE",
          usedAt: null,
          bookingId: null,
          locationId: null,
          startTime: null,
          endTime: null,
          expiresAt: new Date(Date.now() + (packagePurchase.Package.validityDays * 24 * 60 * 60 * 1000)).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    if (packageContents.fullDayPasses && packageContents.fullDayPasses > 0) {
      for (let i = 0; i < packageContents.fullDayPasses; i++) {
        userPasses.push({
          id: uuidv4(),
          packagePurchaseId: packagePurchase.id,
          userId: packagePurchase.userId,
          passType: "FULL_DAY",
          totalCount: 1,
          remainingCount: 1,
          status: "ACTIVE",
          usedAt: null,
          bookingId: null,
          locationId: null,
          startTime: null,
          endTime: null,
          expiresAt: new Date(Date.now() + (packagePurchase.Package.validityDays * 24 * 60 * 60 * 1000)).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    if (packagePurchase.Package.packagetype === "SEMESTER_BUNDLE") {
      userPasses.push({
        id: uuidv4(),
        packagePurchaseId: packagePurchase.id,
        userId: packagePurchase.userId,
        passType: "SEMESTER",
        totalCount: 1,
        remainingCount: 1,
        status: "ACTIVE",
        usedAt: null,
        bookingId: null,
        locationId: null,
        startTime: null,
        endTime: null,
        expiresAt: new Date(Date.now() + (packagePurchase.Package.validityDays * 24 * 60 * 60 * 1000)).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

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