const { sendBookingConfirmation } = require("../utils/email");
const { applyPromoCodeToBooking } = require("./promoCodeController");
const { handlePackageUsage } = require("../utils/packageUsageHelper");
const supabase = require("../config/database");

exports.confirmBookingPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    
    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    const { data: existingBooking, error: checkError } = await supabase
      .from("Booking")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (checkError || !existingBooking) {
      return res.status(404).json({ 
        error: "Booking not found",
        message: `No booking found with ID: ${bookingId}`,
        requestedBookingId: bookingId
      });
    }

    if (existingBooking.confirmedPayment === true || existingBooking.confirmedPayment === "true") {
      let paymentData = null;
      if (existingBooking.paymentId) {
        const { data: payment, error: paymentError } = await supabase
          .from("Payment")
          .select("*")
          .eq("id", existingBooking.paymentId)
          .single();

        if (!paymentError) {
          paymentData = payment;
        }
      }

     
      return res.status(400).json({
        error: "Booking already confirmed",
        message: "This booking has already been confirmed. Cannot confirm again.",
        booking: {
          ...existingBooking,
          confirmedPayment: true,
          status: "already_confirmed"
        },
        payment: paymentData,
        totalAmount: existingBooking.totalAmount,
        confirmedPayment: true,
        alreadyConfirmed: true, 
        requestedBookingId: bookingId
      });
    }

    if (existingBooking.paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from("Payment")
        .select("*")
        .eq("id", existingBooking.paymentId)
        .single();

      if (!paymentError && payment && payment.status === "completed") {
        const { data: updatedBooking, error: updateError } = await supabase
          .from("Booking")
          .update({
            confirmedPayment: true,
            updatedAt: new Date().toISOString()
          })
          .eq("id", bookingId)
          .select()
          .single();

        if (updateError) {
          return res.status(500).json({ error: "Failed to update booking" });
        }

        
        return res.json({
          success: true,
          message: "Booking confirmed successfully (payment was already completed)",
          booking: updatedBooking,
          payment: payment,
          alreadyHadPayment: true
        });
      }
    }

    const { data, error } = await supabase
      .from("Booking")
      .update({
        confirmedPayment: true,
        updatedAt: new Date().toISOString()
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Booking not found" });
    }

    let paymentData = null;
    if (data.paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from("Payment")
        .select("*")
        .eq("id", data.paymentId)
        .single();

      if (!paymentError) {
        paymentData = payment;
      }
    }

    let promoCodeData = null;
    if (data.promocodeid) {
      const { data: promoCode, error: promoError } = await supabase
        .from("PromoCode")
        .select("code, name, description, discounttype, discountvalue")
        .eq("id", data.promocodeid)
        .single();

      if (!promoError && promoCode) {
        promoCodeData = promoCode;
        data.promoCode = promoCode.code;
        data.promoCodeName = promoCode.name;
        data.promoCodeDescription = promoCode.description;
        data.promoCodeType = promoCode.discounttype;
        data.promoCodeValue = promoCode.discountvalue;
        
        // Map database fields to camelCase for invoice generation
        data.promoCodeId = data.promocodeid;
        data.discountAmount = data.discountamount;
      }
    }
    
    // Map database fields to camelCase even if promo code lookup fails
    if (data.promocodeid && !data.promoCodeId) {
      data.promoCodeId = data.promocodeid;
    }
    if (data.discountamount && !data.discountAmount) {
      data.discountAmount = data.discountamount;
    }

    if (data.promocodeid && data.discountamount && data.discountamount > 0) {
      try {
        const promoResult = await applyPromoCodeToBooking(
          data.promocodeid,
          data.userId,
          data.id,
          data.totalCost
        );

        if (promoResult.success) {
          console.log(`Promo code ${promoResult.promoCode.code} usage recorded and count updated`);
        } else {
          console.error("Error recording promo code usage:", promoResult.error);
        }
      } catch (promoError) {
        console.error("Error recording promo code usage:", promoError);
      }
    }

 
    if (data.packageId && data.packageUsed) {
      // Package usage will be handled in confirmBookingPayment function
      // to avoid double counting when payment is confirmed
      console.log(`📦 Package usage will be handled during payment confirmation`);
    } else {
      console.log(`\n ==== PACKAGE USAGE SKIPPED =====`);
    }

    const userData = {
      name: "Customer", 
      email: data.bookedForEmails?.[0]
    };

    if (paymentData) {
     
      data.paymentMethod = paymentData.paymentMethod || null;
      data.paymentDetails = paymentData;
    }

    // Handle package usage if package was used
    let packageUsageResult = null;
    if (data.packageId && data.packageUsed) {
      try {
        console.log(`\n🎯 ===== PACKAGE USAGE ON PAYMENT CONFIRMATION =====`);
        console.log(`📋 Booking ID: ${data.id}`);
        console.log(`📋 User ID: ${data.userId}`);
        console.log(`📋 Package ID: ${data.packageId}`);
        console.log(`📋 Package Used: ${data.packageUsed}`);

        // Calculate hours used from booking duration
        const startTime = new Date(data.startAt);
        const endTime = new Date(data.endAt);
        const hoursUsed = (endTime - startTime) / (1000 * 60 * 60); // Convert to hours
        console.log(`📦 Hours Used: ${hoursUsed}`);
        console.log(`📦 Location: ${data.location}`);
        console.log(`📦 Start Time: ${data.startAt}`);
        console.log(`📦 End Time: ${data.endAt}`);

        console.log(`📦 Calling handlePackageUsage...`);
        packageUsageResult = await handlePackageUsage(
          data.userId,
          data.packageId,
          hoursUsed,
          data.id,
          data.location,
          data.startAt,
          data.endAt
        );

        console.log(`📦 Package usage result:`, JSON.stringify(packageUsageResult, null, 2));

        if (packageUsageResult.success) {
          console.log(`\n✅ ===== PACKAGE USAGE SUCCESS =====`);
          console.log(`✅ Pass Used: ${packageUsageResult.passUsed}`);
          console.log(`✅ Remaining Count: ${packageUsageResult.remainingCount}`);
          console.log(`✅ Pass Type: ${packageUsageResult.passType}`);
          console.log(`✅ Is Pass Fully Used: ${packageUsageResult.isPassFullyUsed}`);

          // Add package discount info to booking data for PDF generation
          data.packageDiscountId = data.packageId;
          // Calculate actual discount amount (remove card processing fee from totalAmount)
          const { getPaymentSettings } = require('../utils/paymentFeeHelper');
          const feeSettings = await getPaymentSettings();
          const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
          const multiplier = 1 + (cardFeePercentage / 100);
          const baseAmount = data.totalAmount / multiplier; // Remove dynamic % card fee
          data.packageDiscountAmount = data.totalCost - baseAmount; // Calculate actual discount amount
          data.packageName = packageUsageResult.packageName || 'Package';
        } else {
          console.error(`\n❌ ===== PACKAGE USAGE FAILED =====`);
          console.error(`❌ Error: ${packageUsageResult.error}`);
          console.error(`❌ Full result:`, JSON.stringify(packageUsageResult, null, 2));
        }
      } catch (packageError) {
        console.error(`\n❌ ===== PACKAGE USAGE EXCEPTION =====`);
        console.error(`❌ Exception:`, packageError);
        console.error(`❌ Stack:`, packageError.stack);
      }
    } else {
      console.log(`\n⚠️ ===== PACKAGE USAGE SKIPPED =====`);
      console.log(`⚠️ Reason: packageId=${data.packageId}, packageUsed=${data.packageUsed}`);
    }
    console.log(`🎯 ===== END PACKAGE USAGE CHECK =====\n`);

    // Fetch package discount information if package was used
    if (data.packageId || data.packageUsed) {
      try {
        console.log('📦 Fetching package usage for booking:', data.id);
        const { data: packageUsage, error: packageError } = await supabase
          .from('BookingPassUse')
          .select('*')
          .eq('bookingId', data.id);
        
        console.log('📦 Package usage query result:', { packageUsage, packageError });
        
        if (!packageError && packageUsage && packageUsage.length > 0) {
          const packageUse = packageUsage[0];
          console.log('📦 Package use details:', packageUse);
          
          // Get package information using the userPassId from BookingPassUse
          if (packageUse.userPassId) {
            try {
              const { data: userPass, error: userPassError } = await supabase
                .from('UserPass')
                .select(`
                  id,
                  Package (
                    id,
                    name,
                    packageType
                  )
                `)
                .eq('id', packageUse.userPassId)
                .single();
              
              if (!userPassError && userPass) {
                data.packageDiscountId = userPass.id;
                
                // Calculate discount amount based on package hoursAllowed (only for 1 person)
                const totalBookingHours = packageUse.minutesApplied / 60;
                
                // Get package hoursAllowed from Package table
                const packageHoursAllowed = userPass.Package?.hoursAllowed || 8; // Default 8 hours
                
                // Package discount applies to only 1 person's hours (not all people)
                const discountHours = Math.min(totalBookingHours, packageHoursAllowed);
                
                let hourlyRate = 6; // Default for MEMBER
                if (data.memberType === 'STUDENT') {
                  hourlyRate = 5;
                } else if (data.memberType === 'TUTOR') {
                  hourlyRate = 4;
                }
                
                // Calculate discount for only 1 person's hours based on hoursAllowed
                data.packageDiscountAmount = discountHours * hourlyRate;
                data.packageName = userPass.Package?.name || 'Package';
                
                // Calculate final amount after package discount
                const originalTotalCost = parseFloat(data.totalCost) || 0;
                const packageDiscount = parseFloat(data.packageDiscountAmount) || 0;
                
                // If package covers all hours (full day), user pays zero
                if (discountHours >= totalBookingHours) {
                    data.totalAmount = 0; // Full package coverage - user pays nothing
                } else {
                    // Partial package coverage - user pays for remaining hours
                    const remainingHours = totalBookingHours - discountHours;
                    const remainingCost = remainingHours * hourlyRate;
                    data.totalAmount = Math.max(0, remainingCost);
                }
                
                console.log('📦 Package discount info added to booking data:', {
                  packageDiscountId: data.packageDiscountId,
                  packageDiscountAmount: data.packageDiscountAmount,
                  packageName: data.packageName,
                  totalBookingHours: totalBookingHours,
                  packageHoursAllowed: packageHoursAllowed,
                  discountHours: discountHours,
                  hourlyRate: hourlyRate,
                  memberType: data.memberType,
                  originalTotalCost: originalTotalCost,
                  finalAmount: data.totalAmount
                });
              }
            } catch (userPassError) {
              console.error('❌ Error fetching UserPass:', userPassError);
            }
          }
        } else {
          console.log('📦 No package usage found or error:', packageError);
          
          // Fallback: Calculate discount from booking data if package usage not found
          if (data.packageId && data.packageUsed) {
            try {
              console.log('📦 Using fallback method to calculate package discount');
              
              // Get package information directly
              const { data: userPass, error: userPassError } = await supabase
                .from('UserPass')
                .select(`
                  id,
                  Package (
                    id,
                    name,
                    packageType
                  )
                `)
                .eq('id', data.packageId)
                .single();
              
              if (!userPassError && userPass) {
                console.log('📦 UserPass found:', userPass);
                
                data.packageDiscountId = userPass.id;
                data.packageName = userPass.Package?.name || 'Package';
                
                // Calculate discount based on package hoursAllowed (only for 1 person)
                const startTime = new Date(data.startAt);
                const endTime = new Date(data.endAt);
                const totalBookingHours = (endTime - startTime) / (1000 * 60 * 60);
                
                // Get package hoursAllowed from Package table
                const packageHoursAllowed = userPass.Package?.hoursAllowed || 8; // Default 8 hours
                
                // Package discount applies to only 1 person's hours (not all people)
                const discountHours = Math.min(totalBookingHours, packageHoursAllowed);
                
                let hourlyRate = 6; // Default for MEMBER
                if (data.memberType === 'STUDENT') {
                  hourlyRate = 5;
                } else if (data.memberType === 'TUTOR') {
                  hourlyRate = 4;
                }
                
                // Calculate discount for only 1 person's hours based on hoursAllowed
                data.packageDiscountAmount = discountHours * hourlyRate;
                
                // Calculate final amount after package discount
                const originalTotalCost = parseFloat(data.totalCost) || 0;
                const packageDiscount = parseFloat(data.packageDiscountAmount) || 0;
                
                // If package covers all hours (full day), user pays zero
                if (discountHours >= totalBookingHours) {
                    data.totalAmount = 0; // Full package coverage - user pays nothing
                } else {
                    // Partial package coverage - user pays for remaining hours
                    const remainingHours = totalBookingHours - discountHours;
                    const remainingCost = remainingHours * hourlyRate;
                    data.totalAmount = Math.max(0, remainingCost);
                }
                
                console.log('📦 Fallback package discount calculated:', {
                  packageDiscountId: data.packageDiscountId,
                  packageDiscountAmount: data.packageDiscountAmount,
                  packageName: data.packageName,
                  totalBookingHours: totalBookingHours,
                  packageHoursAllowed: packageHoursAllowed,
                  discountHours: discountHours,
                  hourlyRate: hourlyRate,
                  memberType: data.memberType,
                  originalTotalCost: originalTotalCost,
                  finalAmount: data.totalAmount
                });
              } else {
                console.log('📦 UserPass not found, using simple calculation');
                
                // The packageId from frontend is actually PackagePurchase ID
                // We need to find UserPass records that belong to this PackagePurchase
                console.log('📦 Looking for UserPass records for PackagePurchase ID:', data.packageId);
                const { data: userPasses, error: userPassesError } = await supabase
                  .from("UserPass")
                  .select("*, PackagePurchase(*, Package(*))")
                  .eq("packagepurchaseid", data.packageId)
                  .eq("userId", data.userId)
                  .eq("status", "ACTIVE")
                  .gt("remainingCount", 0)
                  .limit(1);
                
                if (userPassesError || !userPasses || userPasses.length === 0) {
                  console.error('❌ Error fetching UserPass records:', userPassesError);
                  
                  // Debug: List all UserPass records to see what's available
                  console.log('📦 Available UserPass records:');
                  const { data: allUserPasses, error: allUserPassesError } = await supabase
                    .from("UserPass")
                    .select("id, userId, packagepurchaseid, passtype, hours, status, remainingCount")
                    .eq("userId", data.userId)
                    .limit(10);
                  
                  if (!allUserPassesError && allUserPasses) {
                    console.log('📦 UserPass records for user:', allUserPasses);
                  }
                  
                  // Fallback: Check PackagePurchase directly if UserPass not found
                  console.log('📦 UserPass not found, checking PackagePurchase directly...');
                  const { data: packagePurchase, error: packagePurchaseError } = await supabase
                    .from("PackagePurchase")
                    .select("*, Package(*)")
                    .eq("id", data.packageId)
                    .eq("userId", data.userId)
                    .single();
                  
                  if (packagePurchaseError || !packagePurchase) {
                    console.error('❌ PackagePurchase not found:', packagePurchaseError);
                    return res.status(400).json({ 
                      error: "No active UserPass found for this PackagePurchase and PackagePurchase not found",
                      packagePurchaseId: data.packageId,
                      userId: data.userId,
                      availableUserPasses: allUserPasses || []
                    });
                  }
                  
                  // handlePackageUsage will handle UserPass creation and count decrement
                  // Just use PackagePurchase data for discount calculation
                  console.log('📦 Found PackagePurchase, handlePackageUsage will handle count decrement:', {
                    packagePurchaseId: packagePurchase.id,
                    packageName: packagePurchase.Package?.name,
                    packageType: packagePurchase.Package?.packageType
                  });
                  
                  // Use PackagePurchase data directly for discount calculation
                  const packageData = packagePurchase.Package;
                  if (!packageData) {
                    return res.status(400).json({ error: "Package data not found in PackagePurchase" });
                  }
                  
                  const startTime = new Date(data.startAt);
                  const endTime = new Date(data.endAt);
                  const totalBookingHours = (endTime - startTime) / (1000 * 60 * 60);
                  
                  // Use actual package hoursAllowed from database
                  const packageHoursAllowed = packageData.hoursAllowed || 4;
                  
                  // Package applies to individual person hours, not total booking hours
                  const individualPersonHours = totalBookingHours; // Hours per person
                  
                  // Package can only cover hours for ONE person, not all people
                  const appliedHours = Math.min(individualPersonHours, packageHoursAllowed);
                  const remainingHours = Math.max(0, individualPersonHours - appliedHours);
                  
                  // Get pricing from database for accurate rates
                  const { data: pricingData, error: pricingError } = await supabase
                    .from("pricing_configuration")
                    .select("*")
                    .eq("location", data.location)
                    .eq("memberType", data.memberType)
                    .eq("isActive", true)
                    .single();
                  
                  let pricePerHour;
                  if (pricingData) {
                    pricePerHour = individualPersonHours <= 1 ? 
                      pricingData.oneHourRate : pricingData.overOneHourRate;
                  } else {
                    // Fallback rates
                    if (data.memberType === 'STUDENT') {
                      pricePerHour = individualPersonHours <= 1 ? 4.00 : 3.00;
                    } else if (data.memberType === 'TUTOR') {
                      pricePerHour = individualPersonHours <= 1 ? 6.00 : 5.00;
                    } else {
                      pricePerHour = individualPersonHours <= 1 ? 5.00 : 4.00;
                    }
                  }
                  
                  data.packageDiscountId = data.packageId; // Use PackagePurchase ID
                  data.packageDiscountAmount = appliedHours * pricePerHour; // Discount for 1 person
                  data.packageName = packageData.name || 'Package Applied';
                  
                  // Calculate final amount after package discount (matching frontend logic)
                  const originalTotalCost = parseFloat(data.totalCost) || 0;
                  let finalAmount = 0;
                  
                  // If package covers all hours (full day), user pays zero for the person with package
                  if (appliedHours >= individualPersonHours && individualPersonHours > 0) {
                    // Full package coverage - user pays nothing for the person with package
                    // But other people still pay full price
                    const packagePersonCost = individualPersonHours * pricePerHour;
                    const otherPeopleCost = originalTotalCost - packagePersonCost;
                    finalAmount = Math.max(0, otherPeopleCost);
                  } else {
                    // Partial package coverage - user pays for remaining hours for the person with package
                    // Plus full cost for other people
                    const remainingCostForPackagePerson = remainingHours * pricePerHour;
                    const packagePersonCost = individualPersonHours * pricePerHour;
                    const otherPeopleCost = originalTotalCost - packagePersonCost;
                    finalAmount = Math.max(0, remainingCostForPackagePerson + otherPeopleCost);
                  }
                  
                  data.totalAmount = finalAmount;
                  
                  console.log('📦 Package discount calculated from PackagePurchase (matching frontend):', {
                    packageDiscountId: data.packageDiscountId,
                    packageDiscountAmount: data.packageDiscountAmount,
                    packageName: data.packageName,
                    totalBookingHours: totalBookingHours,
                    individualPersonHours: individualPersonHours,
                    packageHoursAllowed: packageHoursAllowed,
                    appliedHours: appliedHours,
                    remainingHours: remainingHours,
                    pricePerHour: pricePerHour,
                    originalTotalCost: originalTotalCost,
                    finalAmount: data.totalAmount,
                    memberType: data.memberType
                  });
                  
                  // Continue with the flow - don't return error, use PackagePurchase data
                  // The package usage will be handled by handlePackageUsage function
                } else {
                  const userPass = userPasses[0]; // Get the first active UserPass
                
                  // Get the actual Package data through PackagePurchase
                  const packageData = userPass.PackagePurchase?.Package;
                  if (!packageData) {
                    console.error('❌ Package data not found in UserPass');
                    return res.status(400).json({ error: "Package data not found" });
                  }
                  
                  console.log('📦 Found UserPass and Package:', {
                    userPassId: data.packageId,
                    packageId: packageData.id,
                    packageName: packageData.name,
                    hoursAllowed: packageData.hoursAllowed
                  });
                  
                  const startTime = new Date(data.startAt);
                  const endTime = new Date(data.endAt);
                  const totalBookingHours = (endTime - startTime) / (1000 * 60 * 60);
                  
                  // Use actual package hoursAllowed from database
                  const packageHoursAllowed = packageData.hoursAllowed || 4;
                  
                  // Package applies to individual person hours, not total booking hours
                  const individualPersonHours = totalBookingHours; // Hours per person
                  
                  // Package can only cover hours for ONE person, not all people
                  const appliedHours = Math.min(individualPersonHours, packageHoursAllowed);
                  const remainingHours = Math.max(0, individualPersonHours - appliedHours);
                  
                  // Get pricing from database for accurate rates
                  const { data: pricingData, error: pricingError } = await supabase
                    .from("pricing_configuration")
                    .select("*")
                    .eq("location", data.location)
                    .eq("memberType", data.memberType)
                    .eq("isActive", true)
                    .single();
                  
                  let pricePerHour;
                  if (pricingData) {
                    pricePerHour = individualPersonHours <= 1 ? 
                      pricingData.oneHourRate : pricingData.overOneHourRate;
                  } else {
                    // Fallback rates
                    if (data.memberType === 'STUDENT') {
                      pricePerHour = individualPersonHours <= 1 ? 4.00 : 3.00;
                    } else if (data.memberType === 'TUTOR') {
                      pricePerHour = individualPersonHours <= 1 ? 6.00 : 5.00;
                    } else {
                      pricePerHour = individualPersonHours <= 1 ? 5.00 : 4.00;
                    }
                  }
                  
                  data.packageDiscountId = data.packageId;
                  data.packageDiscountAmount = appliedHours * pricePerHour; // Discount for 1 person
                  data.packageName = packageData.name || 'Package Applied';
                  
                  // Calculate final amount after package discount (matching frontend logic)
                  const originalTotalCost = parseFloat(data.totalCost) || 0;
                  let finalAmount = 0;
                  
                  // If package covers all hours (full day), user pays zero for the person with package
                  if (appliedHours >= individualPersonHours && individualPersonHours > 0) {
                    // Full package coverage - user pays nothing for the person with package
                    // But other people still pay full price
                    const packagePersonCost = individualPersonHours * pricePerHour;
                    const otherPeopleCost = originalTotalCost - packagePersonCost;
                    finalAmount = Math.max(0, otherPeopleCost);
                  } else {
                    // Partial package coverage - user pays for remaining hours for the person with package
                    // Plus full cost for other people
                    const remainingCostForPackagePerson = remainingHours * pricePerHour;
                    const packagePersonCost = individualPersonHours * pricePerHour;
                    const otherPeopleCost = originalTotalCost - packagePersonCost;
                    finalAmount = Math.max(0, remainingCostForPackagePerson + otherPeopleCost);
                  }
                  
                  data.totalAmount = finalAmount;
                  
                  console.log('📦 Package discount calculated (matching frontend):', {
                    packageDiscountId: data.packageDiscountId,
                    packageDiscountAmount: data.packageDiscountAmount,
                    packageName: data.packageName,
                    totalBookingHours: totalBookingHours,
                    individualPersonHours: individualPersonHours,
                    packageHoursAllowed: packageHoursAllowed,
                    appliedHours: appliedHours,
                    remainingHours: remainingHours,
                    pricePerHour: pricePerHour,
                    originalTotalCost: originalTotalCost,
                    finalAmount: data.totalAmount,
                    memberType: data.memberType
                  });
                }
              }
            } catch (fallbackError) {
              console.error('❌ Error in fallback package calculation:', fallbackError);
            }
          }
        }
      } catch (packageFetchError) {
        console.error('❌ Error fetching package usage:', packageFetchError);
      }
    }

    // Handle credit amount - if discountamount exists and no promo code, treat as credit
    if (data.discountamount && data.discountamount > 0 && !data.promoCodeId && !data.promocodeid) {
      data.creditAmount = data.discountamount;
      console.log('💳 Credit amount from discountamount field:', data.creditAmount);
    }

    // Log booking confirmation data
    console.log('📧 Sending booking confirmation for booking:', data.id);
    console.log('📧 Booking data for email/PDF generation:', {
      packageDiscountAmount: data.packageDiscountAmount,
      packageName: data.packageName,
      packageDiscountId: data.packageDiscountId,
      creditAmount: data.creditAmount,
      totalCost: data.totalCost,
      totalAmount: data.totalAmount,
      discountAmount: data.discountAmount,
      promoCodeId: data.promoCodeId
    });

    await sendBookingConfirmation(userData, data);

    res.status(200).json({
      message: "Payment confirmed & confirmation email sent successfully",
      booking: data,
      payment: paymentData,
      promoCode: promoCodeData,
      totalAmount: data.totalAmount,
      confirmedPayment: data.confirmedPayment,
      packageUsage: packageUsageResult
    });
  } catch (err) {
    console.error("confirmBookingPayment error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.confirmBookingWithPackage = async (req, res) => {
  try {
    const {
      bookingId,
      userId,
      packageId,
      hoursUsed,
      location,
      startTime,
      endTime,
      paymentId
    } = req.body;

    if (!bookingId || !userId || !packageId || !hoursUsed) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "bookingId, userId, packageId, and hoursUsed are required"
      });
    }

    const { data: booking, error: bookingError } = await supabase
      .from("Booking")
      .select("*")
      .eq("id", bookingId)
      .eq("userId", userId)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({
        error: "Booking not found",
        message: "The specified booking does not exist"
      });
    }

    if (booking.confirmedPayment) {
      return res.status(409).json({
        error: "Booking already confirmed",
        message: "This booking has already been confirmed"
      });
    }

    const packageUsageResult = await handlePackageUsage(
      userId,
      packageId,
      hoursUsed,
      bookingId,
      location || booking.location,
      startTime || booking.startAt,
      endTime || booking.endAt
    );

    if (!packageUsageResult.success) {
      return res.status(400).json({
        error: "Package usage failed",
        message: packageUsageResult.error
      });
    }

    let totalAmount = 0;

    const { data: updatedBooking, error: updateError } = await supabase
      .from("Booking")
      .update({
        confirmedPayment: true,
        paymentId: paymentId || "PACKAGE_USED",
        totalAmount: totalAmount,
        packageUsed: packageId,
        packagePassUsed: packageUsageResult.passUsed,
        passType: packageUsageResult.passType,
        remainingCount: packageUsageResult.remainingCount,
        updatedAt: new Date().toISOString()
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({
        error: "Failed to update booking",
        message: updateError.message
      });
    }

    try {
      const userData = {
        name: "Customer", 
        email: updatedBooking.bookedForEmails?.[0]
      };
      
      // Add package discount information to booking data
      if (packageUsageResult && packageUsageResult.passUsed) {
        updatedBooking.packageDiscountId = packageId;
        updatedBooking.packageDiscountAmount = packageUsageResult.discountAmount || 0;
        updatedBooking.packageName = packageUsageResult.packageType || 'Package';
        console.log('📦 Package discount info added to booking data:', {
          packageDiscountId: updatedBooking.packageDiscountId,
          packageDiscountAmount: updatedBooking.packageDiscountAmount,
          packageName: updatedBooking.packageName
        });
      }
      
      await sendBookingConfirmation(userData, updatedBooking);
    } catch (emailError) {
      console.error("Error sending confirmation email:", emailError);
    }

    res.json({
      success: true,
      message: "Booking confirmed successfully with package usage",
      booking: updatedBooking,
      packageUsage: {
        passUsed: packageUsageResult.passUsed,
        passType: packageUsageResult.passType,
        remainingCount: packageUsageResult.remainingCount,
        packageType: packageUsageResult.packageType,
        totalPasses: packageUsageResult.totalPasses,
        remainingPasses: packageUsageResult.remainingPasses
      }
    });

  } catch (err) {
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    });
  }
};

exports.getBookingPaymentDetails = async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    // Get booking details with all discount information
    const { data: booking, error: bookingError } = await supabase
      .from('Booking')
      .select('id, totalAmount, totalCost, discountamount, packageId, packageUsed, paymentId, bookingRef, promocodeid, promoCodeId')
      .eq('id', bookingId)
      .single();


    if (bookingError || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    let paymentAmount = parseFloat(booking.totalAmount) || 0;
    let paymentMethod = 'Unknown';
    const totalCost = parseFloat(booking.totalCost) || 0;
    
    // Determine if discountamount is promo code or credit
    let promoDiscountAmount = 0;
    console.log('🔍 Checking promo code detection:', {
      discountamount: booking.discountamount,
      promocodeid: booking.promocodeid,
      promoCodeId: booking.promoCodeId,
      hasPromoCode: !!(booking.promoCodeId || booking.promocodeid)
    });
    
    if (booking.discountamount && booking.discountamount > 0 && (booking.promoCodeId || booking.promocodeid)) {
      // If there's a promo code, discountamount is promo discount
      promoDiscountAmount = parseFloat(booking.discountamount) || 0;
      console.log('💳 Promo code discount found:', promoDiscountAmount);
    } else {
      console.log('💳 No promo code discount (discountamount will be treated as credit if credits were used)');
    }

    // Get ALL payment details (original + reschedule) for accurate refund calculation
    console.log('🔍 Finding all payments for booking payment details:', {
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      paymentId: booking.paymentId
    });

    // First, let's check what payments exist for this booking
    // Try multiple query patterns to find all related payments
    // Sanitize booking references to prevent SQL injection
    const { sanitizeBookingRef, sanitizeUUID, buildSafeOrQuery } = require("../utils/inputSanitizer");
    
    // FIXED: Use buildSafeOrQuery instead of string interpolation
    const orConditions = [];
    if (booking.bookingRef) {
      const sanitizedRef = sanitizeBookingRef(booking.bookingRef);
      if (sanitizedRef) {
        orConditions.push({ field: 'bookingRef', operator: 'eq', value: sanitizedRef });
      }
    }
    
    const sanitizedBookingId = sanitizeUUID(booking.id);
    if (sanitizedBookingId) {
      orConditions.push({ field: 'bookingRef', operator: 'eq', value: `RESCHEDULE_${sanitizedBookingId}` });
      orConditions.push({ field: 'bookingRef', operator: 'eq', value: sanitizedBookingId });
    }
    
    const safeOrQuery = buildSafeOrQuery(orConditions);
    
    const { data: allPaymentsCheck, error: checkError } = await supabase
      .from('Payment')
      .select('id, totalAmount, cost, paymentMethod, bookingRef, createdAt')
      .or(safeOrQuery || 'id.eq.null') // Use null condition if no valid conditions
      .order('createdAt', { ascending: true });

    console.log('🔍 All payments found for booking:', allPaymentsCheck);
    // Log sanitized query for debugging (using sanitized values)
    console.log('🔍 Query used:', safeOrQuery || 'id.eq.null');

    // Also try a broader search to see all payments
    const { data: allPaymentsBroader, error: broaderError } = await supabase
      .from('Payment')
      .select('id, totalAmount, cost, paymentMethod, bookingRef, createdAt')
      .ilike('bookingRef', `%${booking.bookingRef}%`)
      .order('createdAt', { ascending: true });

    console.log('🔍 Broader search results:', allPaymentsBroader);

    // Use the broader search results if the specific query didn't find multiple payments
    const allPayments = (allPaymentsCheck && allPaymentsCheck.length > 1) ? allPaymentsCheck : allPaymentsBroader;
    const paymentsError = checkError;

    if (allPayments && !paymentsError && allPayments.length > 0) {
      console.log('📊 Found payments for booking payment details:', allPayments.map(p => ({
        id: p.id,
        bookingRef: p.bookingRef,
        amount: p.totalAmount || p.cost,
        paymentMethod: p.paymentMethod,
        createdAt: p.createdAt
      })));

      // Sum up all payments
      paymentAmount = allPayments.reduce((sum, payment) => {
        const amount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
        return sum + amount;
      }, 0);

      // Use the payment method from the most recent payment
      const latestPayment = allPayments[allPayments.length - 1];
      paymentMethod = latestPayment.paymentMethod || 'Unknown';

      console.log('💰 Total payment amount for UI:', paymentAmount);
    } else {
      console.log('⚠️ No payments found, using fallback methods...');
      
      // Fallback: try to get payment by paymentId (single payment)
      if (booking.paymentId) {
        const { data: payment, error: paymentError } = await supabase
          .from('Payment')
          .select('totalAmount, cost, paymentMethod')
          .eq('id', booking.paymentId)
          .single();

        if (payment && !paymentError) {
          paymentAmount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
          paymentMethod = payment.paymentMethod || 'Unknown';
          console.log('📊 Fallback: Found single payment by paymentId:', paymentAmount);
        }
      }
    }
    
    // Calculate package discount amount if package was used
    let packageDiscountAmount = 0;
    if (booking.packageUsed && booking.packageId) {
      // First, get the payment amount before card fee to calculate package discount correctly
      let amountBeforeCardFee = paymentAmount;
      const isCardPayment = paymentMethod && 
        (paymentMethod.toLowerCase().includes('card') || 
         paymentMethod.toLowerCase().includes('credit'));
      
      if (isCardPayment) {
        // If card payment, remove dynamic % fee to get the amount before card fee
        const { getPaymentSettings } = require('../utils/paymentFeeHelper');
        const feeSettings = await getPaymentSettings();
        const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
        const multiplier = 1 + (cardFeePercentage / 100);
        amountBeforeCardFee = paymentAmount / multiplier;
      }
      
      // Package discount = totalCost - amountBeforeCardFee
      packageDiscountAmount = Math.max(0, totalCost - amountBeforeCardFee);
    }
    
    // Find credit usage for this booking to show accurate credit information
    console.log('🔍 Finding credit usage for booking payment details...');
    const { data: creditUsages, error: creditUsageError } = await supabase
      .from('creditusage')
      .select('id, amountused, creditid, usercredits(amount, status)')
      .eq('bookingid', bookingId);

    let creditAmount = 0;
    if (creditUsages && !creditUsageError) {
      creditAmount = creditUsages.reduce((sum, usage) => {
        const amount = parseFloat(usage.amountused) || 0;
        return sum + amount;
      }, 0);
      console.log('💳 Total credits used for this booking:', creditAmount);
    } else {
      console.log('💳 No credit usage found for this booking');
    }

    // Calculate fees based on payment methods (handle multiple payments)
    let cardFee = 0;
    let payNowFee = 0;
    
    // Load payment settings ONCE before loop
    const { getPaymentSettings } = require('../utils/paymentFeeHelper');
    const feeSettings = await getPaymentSettings();
    const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
    const paynowFeeAmount = feeSettings.PAYNOW_TRANSACTION_FEE || 0.20;
    
    if (allPayments && allPayments.length > 0) {
      console.log('💳 Calculating fees for each payment in UI...');
      
      allPayments.forEach((payment, index) => {
        const paymentAmount = parseFloat(payment.totalAmount) || parseFloat(payment.cost) || 0;
        const paymentMethod = payment.paymentMethod || '';
        
        const isCardPayment = paymentMethod && 
          (paymentMethod.toLowerCase().includes('card') || 
           paymentMethod.toLowerCase().includes('credit'));
        
        const isPayNowPayment = paymentMethod && 
          (paymentMethod.toLowerCase().includes('paynow') || 
           paymentMethod.toLowerCase().includes('pay_now'));
        
        if (isCardPayment) {
          // Calculate dynamic % card fee for this payment
          const multiplier = 1 + (cardFeePercentage / 100);
          const subtotal = paymentAmount / multiplier;
          const feeForThisPayment = paymentAmount - subtotal;
          cardFee += feeForThisPayment;
          
          console.log(`💳 Card payment ${index + 1} fee:`, {
            amount: paymentAmount,
            fee: feeForThisPayment,
            totalCardFee: cardFee
          });
        } else if (isPayNowPayment && paymentAmount < 10) {
          // PayNow dynamic fee - ONLY for amounts < $10
          payNowFee += paynowFeeAmount;
          
          console.log(`💳 PayNow payment ${index + 1} fee:`, {
            amount: paymentAmount,
            fee: paynowFeeAmount,
            totalPayNowFee: payNowFee
          });
        }
      });
      
      console.log('💳 Total fees calculated:', {
        totalCardFee: cardFee,
        totalPayNowFee: payNowFee,
        totalPaymentAmount: paymentAmount
      });
    } else {
      // Fallback: use original logic for single payment
      const isCardPayment = paymentMethod && 
        (paymentMethod.toLowerCase().includes('card') || 
         paymentMethod.toLowerCase().includes('credit'));
      
      const isPayNowPayment = paymentMethod && 
        (paymentMethod.toLowerCase().includes('paynow') || 
         paymentMethod.toLowerCase().includes('pay_now'));
      
      if (isCardPayment) {
        // Use already loaded feeSettings
        const multiplier = 1 + (cardFeePercentage / 100);
        const subtotal = paymentAmount / multiplier;
        cardFee = paymentAmount - subtotal;
      } else if (isPayNowPayment && paymentAmount < 10) {
        // Use already loaded feeSettings - ONLY for amounts < $10
        payNowFee = paynowFeeAmount;
      }
    }

    res.json({
      bookingId: booking.id,
      paymentAmount: paymentAmount,
      paymentMethod: paymentMethod,
      bookingRef: booking.bookingRef,
      promoDiscountAmount: promoDiscountAmount,
      packageDiscountAmount: packageDiscountAmount,
      creditAmount: creditAmount,
      totalDiscountAmount: promoDiscountAmount + packageDiscountAmount + creditAmount,
      cardFee: Math.round(cardFee * 100) / 100, // Round to 2 decimal places
      payNowFee: Math.round(payNowFee * 100) / 100, // Round to 2 decimal places
      totalCost: totalCost,
      refundPolicy: {
        creditsRefundable: false,
        discountsRefundable: false,
        promoCodeRefundable: false,
        policy: 'Credits, discounts, and promo codes are non-refundable'
      }
    });

  } catch (error) {
    console.error('Error getting booking payment details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

