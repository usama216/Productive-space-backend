const PDFDocument = require('pdfkit');
const fs = require("fs");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
const { formatForInvoice, getCurrentSingaporeDateTime } = require('./timezoneUtils');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Function to get pricing configuration for a location and member type
const getPricingConfig = async (location, memberType) => {
  try {
    console.log('🔍 Fetching pricing config from DB:', { location, memberType });
    
    const { data, error } = await supabase
      .from('pricing_configuration')
      .select('*')
      .eq('location', location)
      .eq('memberType', memberType)
      .eq('isActive', true)
      .single();

    if (error) {
      console.error('❌ Error fetching pricing config:', error);
      console.log('⚠️ Using default pricing as fallback');
      // Fallback to default pricing if not found
      const defaultPricing = {
        student: { oneHourRate: 4.00, overOneHourRate: 4.00 },
        member: { oneHourRate: 5.00, overOneHourRate: 5.00 },
        tutor: { oneHourRate: 6.00, overOneHourRate: 6.00 }
      };
      return defaultPricing[memberType?.toLowerCase()] || defaultPricing.member;
    }

    if (!data) {
      console.log('⚠️ No data found in pricing_configuration table, using defaults');
      const defaultPricing = {
        student: { oneHourRate: 4.00, overOneHourRate: 4.00 },
        member: { oneHourRate: 5.00, overOneHourRate: 5.00 },
        tutor: { oneHourRate: 6.00, overOneHourRate: 6.00 }
      };
      return defaultPricing[memberType?.toLowerCase()] || defaultPricing.member;
    }

    console.log('✅ Found pricing config in DB:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception in getPricingConfig:', error);
    // Fallback to default pricing
    const defaultPricing = {
      student: { oneHourRate: 4.00, overOneHourRate: 4.00 },
      member: { oneHourRate: 5.00, overOneHourRate: 5.00 },
      tutor: { oneHourRate: 6.00, overOneHourRate: 6.00 }
    };
    return defaultPricing[memberType?.toLowerCase()] || defaultPricing.member;
  }
};

const generateInvoicePDF = (userData, bookingData) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Get dynamic payment fee settings
            const { getPaymentSettings } = require('./paymentFeeHelper');
            const feeSettings = await getPaymentSettings();
            const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
            
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            const fileName = `Invoice_${bookingData.bookingRef || bookingData.id || Date.now()}.pdf`;
            const filePath = path.join('/tmp', fileName);

            const tempDir = path.dirname(filePath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            doc.pipe(fs.createWriteStream(filePath));

            const headerFont = 'Helvetica-Bold';
            const bodyFont = 'Helvetica';
            const titleFontSize = 18;
            const sectionHeaderFontSize = 12;
            const bodyFontSize = 10;
            const smallFontSize = 8;

      

try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");

    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 60, 60, { width: 150, height: 60 });
    } else {
        doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
    }
} catch (logoError) {
    doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
}




            doc.fillColor('#000000')
                .font(bodyFont).fontSize(smallFontSize)
                .text('My Productive Space', 60, 130)  
                .text('Company ID: 53502976D', 60, 140)  
                .text('Blk 208 Hougang st 21 #01-201', 60, 150)  
                .text('Hougang 530208', 60, 160)  
                .text('Singapore', 60, 170)  
                .text('89202462', 60, 180)  
                .text('myproductivespacecontact@gmail.com', 60, 190); 

           const invoiceNumber = `INV-${String(bookingData.id || '000001').slice(-6).padStart(6, '0')}`;
            doc.font(headerFont).fontSize(titleFontSize)
                .text('INVOICE', 400, 60)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`# ${invoiceNumber}`, 400, 85);

          
            const currentDateTime = getCurrentSingaporeDateTime();
            
            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('Invoice Date:', 400, 170).text(currentDateTime.date, 480, 170)
                .text('Invoice Time:', 400, 185).text(currentDateTime.time, 480, 185)
                .text('Due Date:', 400, 200).text(currentDateTime.date, 480, 200);

            // Bill To section with proper alignment
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Bill To', 60, 230)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(userData.email || '', 60, 250, { width: 300 });

            const tableTop = 300;
            doc.rect(50, tableTop, 500, 25).fill('#2C3E50').stroke();
            doc.fillColor('#FFFFFF').font(headerFont).fontSize(bodyFontSize)
                .text('#', 60, tableTop + 8)
                .text('Location & Date/Time', 90, tableTop + 8)
                .text('Hours', 380, tableTop + 8)
                .text('Rate', 415, tableTop + 8)
                .text('Amount', 480, tableTop + 8);

            let currentY = tableTop + 30;
            doc.rect(50, currentY, 500, 30).fill('#F8F9FA').stroke();

            const startFormatted = formatForInvoice(bookingData.startAt);
            const endFormatted = formatForInvoice(bookingData.endAt);
            
            // Calculate actual hours (no rounding - exact time difference)
            const startDate = bookingData.startAt ? new Date(bookingData.startAt) : new Date();
            const endDate = bookingData.endAt ? new Date(bookingData.endAt) : new Date();
            const actualHours = bookingData.endAt ?
                ((endDate - startDate) / (1000 * 60 * 60)) : 1;
            
            // Format hours for DISPLAY (max 2 decimals, no rounding up)
            const formattedHours = actualHours % 1 === 0 ? 
                `${Math.floor(actualHours)}` : 
                `${actualHours.toFixed(2)}`;

            let description = bookingData.location ?
                `${bookingData.location} - ${startFormatted.date} (${startFormatted.time} - ${endFormatted.time})` :
                `Workspace Booking - ${startFormatted.date} (${startFormatted.time} - ${endFormatted.time})`;

            // Calculate payment details to get the subtotal (before fees and discounts)
            const { calculatePaymentDetails } = require('./calculationHelper');
            const paymentDetails = await calculatePaymentDetails(bookingData);
            
            // Dynamic pricing: Use the correct formula with dynamic rates from pricing_configuration table
            const members = bookingData.members || 0;
            const tutors = bookingData.tutors || 0;
            const students = bookingData.students || 0;
            const location = bookingData.location || 'Kovan';
            
            let rate = 0;
            
            if (members > 0 || tutors > 0 || students > 0) {
                // Get dynamic pricing for each member type
                const memberPricing = await getPricingConfig(location, 'MEMBER');
                const tutorPricing = await getPricingConfig(location, 'TUTOR');
                const studentPricing = await getPricingConfig(location, 'STUDENT');
                
                // Use oneHourRate for all calculations (as per your formula)
                const memberRate = memberPricing.oneHourRate || 4.00;
                const tutorRate = tutorPricing.oneHourRate || 5.00;
                const studentRate = studentPricing.oneHourRate || 3.00;
                
                // Apply the formula: (Members × memberRate) + (Tutors × tutorRate) + (Students × studentRate)
                rate = (members * memberRate) + (tutors * tutorRate) + (students * studentRate);
            } else {
                // Fallback: Use booking's memberType and pax
                const memberType = bookingData.memberType || 'MEMBER';
                const pax = bookingData.pax || 1;
                const pricing = await getPricingConfig(location, memberType);
                rate = pax * (pricing.oneHourRate || 4.00);
            }
            
            // Use the original amount from payment details
            const amount = paymentDetails.originalAmount;

            doc.fillColor('#000000').font(bodyFont).fontSize(bodyFontSize)
                .text('1', 60, currentY + 10)
                .text(description, 90, currentY + 10, { width: 280 })
                .text(formattedHours, 385, currentY + 10)
                .text(`$${rate.toFixed(2)}`, 420, currentY + 10)
                .text(`$${amount.toFixed(2)}`, 480, currentY + 10);

            currentY += 40;
            
            const hasRoleInfo = (bookingData.students > 0 || bookingData.members > 0 || bookingData.tutors > 0) || 
                               (bookingData.seatNumbers && bookingData.seatNumbers.length > 0);
            
            if (hasRoleInfo) {
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Role & Seat Information', 50, currentY);
                
                currentY += 20;
                
                let roleSummary = [];
                if (bookingData.students > 0) roleSummary.push(`${bookingData.students} Student(s)`);
                if (bookingData.members > 0) roleSummary.push(`${bookingData.members} Member(s)`);
                if (bookingData.tutors > 0) roleSummary.push(`${bookingData.tutors} Tutor(s)`);
                
                if (roleSummary.length > 0) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Total: ${roleSummary.join(', ')}`, 50, currentY);
                    currentY += 15;
                }
                
                if (bookingData.seatNumbers && bookingData.seatNumbers.length > 0) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Assigned Seats: ${bookingData.seatNumbers.join(', ')}`, 50, currentY);
                    currentY += 15;
                }
                
            }

            // Check if any discounts or credits were applied
            const hasPromoCodeDiscount = bookingData.promoCodeId && bookingData.discountAmount && bookingData.discountAmount > 0;
            const hasPackageDiscount = bookingData.packageDiscountAmount && bookingData.packageDiscountAmount > 0;
            const hasCreditsApplied = bookingData.creditAmount && bookingData.creditAmount > 0;
            
            if (hasPromoCodeDiscount || hasPackageDiscount || hasCreditsApplied) {
                currentY += 20;
                doc.font(headerFont).fontSize(sectionHeaderFontSize)
                    .text('Discounts & Credits Applied', 50, currentY);
                  
                    currentY += 15;

                    doc.font(bodyFont).fontSize(8)
                        .fillColor('#666666')
                        .text('All Discounts, Pass, Credits applied are not refundable.', 50, currentY);
                    doc.fillColor('#000000'); // Reset to black
                   
                currentY += 20;
                
                if (hasPromoCodeDiscount) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Promo Code: ${bookingData.promoCode || bookingData.promoCodeId}`, 50, currentY);
                    currentY += 15;
                    
                    if (bookingData.promoCodeName) {
                        doc.font(bodyFont).fontSize(bodyFontSize)
                            .text(`Promo Code Name: ${bookingData.promoCodeName}`, 50, currentY);
                        currentY += 15;
                    }
                    
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Promo Discount: SGD ${(parseFloat(bookingData.discountAmount) || 0).toFixed(2)}`, 50, currentY);
                    currentY += 15;
                }
                
                if (hasPackageDiscount) {
                    // When package fully covers the booking, show the actual booking amount
                    // Otherwise show the calculated package discount amount
                    const packageAmount = parseFloat(bookingData.totalAmount) === 0 ? 
                        parseFloat(bookingData.totalCost) || 0 : 
                        parseFloat(bookingData.packageDiscountAmount) || 0;
                    
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Package Discount: SGD ${packageAmount.toFixed(2)}`, 50, currentY);
                    currentY += 15;
                    
                    if (bookingData.packageName) {
                        doc.font(bodyFont).fontSize(bodyFontSize)
                            .text(`Package: ${bookingData.packageName}`, 50, currentY);
                        currentY += 15;
                    }
                    
                  
                }
                
                if (hasCreditsApplied) {
                    doc.font(bodyFont).fontSize(bodyFontSize)
                        .text(`Credits Applied: SGD ${(parseFloat(bookingData.creditAmount) || 0).toFixed(2)}`, 50, currentY);
                    currentY += 15;
                }
               
                currentY += 20;
            }

            // paymentDetails already calculated above for rate calculation

            const pageWidth = 595;
            const summaryWidth = pageWidth * 0.4; 
            const summaryStartX = pageWidth - summaryWidth - 50; 
            
            const hasPromoCodeSummary = bookingData.promoCodeId && bookingData.discountAmount && bookingData.discountAmount > 0;
            const hasPackageSummary = bookingData.packageDiscountAmount && bookingData.packageDiscountAmount > 0;
            const hasCreditsSummary = bookingData.creditAmount && bookingData.creditAmount > 0;
            
            if (hasRoleInfo || hasPromoCodeSummary || hasPackageSummary || hasCreditsSummary) {
                currentY += 20; 
            } else {
                currentY += 50; 
            } 
            doc.font(bodyFont).fontSize(bodyFontSize)
                .text('Sub Total', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${paymentDetails.originalAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            // Only show promo code discount if there's actually a promo code used
            if (bookingData.promoCodeId && paymentDetails.discount && paymentDetails.discount.discountAmount > 0) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Promo Code Discount', summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`-SGD ${paymentDetails.discount.discountAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            if (hasPackageSummary) {
                currentY += 20;
                // When package fully covers the booking, show the actual booking amount
                // Otherwise show the calculated package discount amount
                const packageAmount = parseFloat(bookingData.totalAmount) === 0 ? 
                    parseFloat(bookingData.totalCost) || 0 : 
                    parseFloat(bookingData.packageDiscountAmount) || 0;
                
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Package Discount', summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`-SGD ${packageAmount.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            if (hasCreditsSummary) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Credits Applied', summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`-SGD ${(parseFloat(bookingData.creditAmount) || 0).toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            if (paymentDetails.isCardPayment) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Card Fee (${cardFeePercentage}%)`, summaryStartX, currentY, { width: summaryWidth - 20 })
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`SGD ${paymentDetails.cardFee.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            // PayNow transaction fee (for amounts less than $10)
            if (paymentDetails.isPayNowPayment && paymentDetails.payNowFee > 0) {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Transaction Fee', summaryStartX, currentY, { width: summaryWidth - 20 })
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`SGD ${paymentDetails.payNowFee.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);
            }

            // Only show payment method if it has a valid value
            if (paymentDetails.paymentMethod && 
                paymentDetails.paymentMethod.toLowerCase() !== 'unknown' && 
                paymentDetails.paymentMethod.trim() !== '') {
                currentY += 20;
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text('Payment Method', summaryStartX, currentY)
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(paymentDetails.paymentMethod, summaryStartX + summaryWidth - 80, currentY);
            }

            currentY += 20;
            doc.font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Total', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${paymentDetails.finalTotal.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            currentY += 20;
            doc.fillColor('#000000').font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Paid', summaryStartX, currentY)
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`SGD ${paymentDetails.finalTotal.toFixed(2)}`, summaryStartX + summaryWidth - 80, currentY);

            doc.end();

            doc.on('end', () => {
                resolve({ filePath, fileName });
            });

            doc.on('error', (err) => {
                reject(err);
            });

        } catch (error) {
            reject(error);
        }
    });
};

const generateExtensionInvoicePDF = (userData, bookingData, extensionInfo) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Get dynamic payment fee settings
            const { getPaymentSettings } = require('./paymentFeeHelper');
            const feeSettings = await getPaymentSettings();
            const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
            
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            const fileName = `Extension_Invoice_${bookingData.bookingRef || bookingData.id || Date.now()}.pdf`;
            const filePath = path.join('/tmp', fileName);

            const tempDir = path.dirname(filePath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            doc.pipe(fs.createWriteStream(filePath));

            const headerFont = 'Helvetica-Bold';
            const bodyFont = 'Helvetica';
            const titleFontSize = 18;
            const sectionHeaderFontSize = 12;
            const bodyFontSize = 10;
            const smallFontSize = 8;

            // Logo
            try {
                const logoPath = path.join(process.cwd(), "public", "logo.png");
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 60, 60, { width: 150, height: 60 });
                } else {
                    doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
                }
            } catch (logoError) {
                doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
            }

            // Company details
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(smallFontSize)
                .text('My Productive Space', 60, 130)  
                .text('Company ID: 53502976D', 60, 140)  
                .text('Blk 208 Hougang st 21 #01-201', 60, 150)  
                .text('Hougang 530208', 60, 160)  
                .text('Singapore', 60, 170)  
                .text('Tel: 89202462', 60, 180);

            // Bill To section
            doc.fillColor('#000000')
                .font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Bill To', 400, 130);

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text(userData.email || 'N/A', 400, 150);

            // Invoice title
            doc.fillColor('#000000')
                .font(headerFont).fontSize(titleFontSize)
                .text('BOOKING EXTENSION INVOICE', 60, 220);

            // Extension details
            const startDate = new Date(bookingData.startAt);
            const originalEndDate = new Date(extensionInfo.originalEndAt || bookingData.endAt);
            const newEndDate = new Date(bookingData.endAt);
            
            const formatDate = (date) => {
                return formatForInvoice(date).date;
            };

            const formatTime = (date) => {
                return formatForInvoice(date).time;
            };

            // Extension summary
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`Reference: ${bookingData.bookingRef || 'N/A'}`, 60, 260)
                .text(`Location: ${bookingData.location || 'N/A'}`, 60, 275)
                .text(`Extension Date: ${formatDate(newEndDate)}`, 60, 290)
                .text(`Original End Time: ${formatTime(originalEndDate)}`, 60, 305)
                .text(`New End Time: ${formatTime(newEndDate)}`, 60, 320)
                .text(`Extension Hours: ${extensionInfo.extensionHours || 0}`, 60, 335);

            // Table header
            const tableTop = 360;
            const col1 = 60;
            const col2 = 120;
            const col3 = 250;
            const col4 = 320;
            const col5 = 420;
            const col6 = 500;

            doc.fillColor('#333333')
                .rect(col1, tableTop, col6 - col1, 20)
                .fill();

            doc.fillColor('#FFFFFF')
                .font(headerFont).fontSize(bodyFontSize)
                .text('#', col1 + 5, tableTop + 5)
                .text('Description', col2, tableTop + 5)
                .text('Hours', col3, tableTop + 5)
                .text('Rate', col4, tableTop + 5)
                .text('Amount', col5, tableTop + 5);

            // Extension item row
            const itemTop = tableTop + 20;
            doc.fillColor('#F8F8F8')
                .rect(col1, itemTop, col6 - col1, 20)
                .fill();

            const extensionHours = extensionInfo.extensionHours || 0;
            const extensionAmount = extensionInfo.extensionCost || 0;
            
            // Calculate rate per person per hour so that: Rate × Hours × People = Amount
            const totalPeople = (bookingData.members || 0) + (bookingData.tutors || 0) + (bookingData.students || 0);
            const ratePerPersonPerHour = (extensionHours > 0 && totalPeople > 0) ? 
                extensionAmount / extensionHours / totalPeople : 
                (extensionHours > 0 ? extensionAmount / extensionHours : 0);

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text('1', col1 + 5, itemTop + 5)
                .text(`Extension - ${bookingData.location}`, col2, itemTop + 5)
                .text(`${extensionHours.toFixed(2)}`, col3, itemTop + 5)
                .text(`$${ratePerPersonPerHour.toFixed(2)}`, col4, itemTop + 5)
                .text(`$${extensionAmount.toFixed(2)}`, col5, itemTop + 5);

            // Role & Seat Information
            const roleTop = itemTop + 40;
            doc.fillColor('#000000')
                .font(headerFont).fontSize(bodyFontSize)
                .text('Role & Seat Information', 60, roleTop);

            const memberTypeText = bookingData.memberType === 'STUDENT' ? 'Student(s)' : 
                                  bookingData.memberType === 'TUTOR' ? 'Tutor(s)' : 'Member(s)';

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`Total: ${bookingData.pax || 1} ${memberTypeText}`, 60, roleTop + 20)
                .text(`Assigned Seats: ${(bookingData.seatNumbers || []).join(', ') || 'N/A'}`, 60, roleTop + 35);

            // Discounts & Credits Applied Section
            const discountsTop = roleTop + 55;
            
            // Check if any credits were applied
            const hasCreditsApplied = extensionInfo.creditAmount && extensionInfo.creditAmount > 0;
            
            if (hasCreditsApplied) {
                doc.fillColor('#000000')
                    .font(headerFont).fontSize(bodyFontSize)
                    .text('Discounts & Credits Applied', 60, discountsTop);
                  
                doc.font(bodyFont).fontSize(8)
                    .fillColor('#666666')
                    .text('All Discounts, Pass, Credits applied are not refundable.', 60, discountsTop + 15);
                doc.fillColor('#000000'); // Reset to black
               
                doc.font(bodyFont).fontSize(bodyFontSize)
                    .text(`Credits Applied: SGD ${(parseFloat(extensionInfo.creditAmount) || 0).toFixed(2)}`, 60, discountsTop + 35);
            }

            // Totals section
            const totalsTop = roleTop + 80;
            const subtotal = extensionAmount;
            const creditAmount = extensionInfo.creditAmount || 0;
            const paymentFee = extensionInfo.paymentFee || 0;
            const finalTotal = extensionInfo.finalAmount || (Math.max(0, subtotal - creditAmount) + paymentFee);
            
            // Get payment method for display
            const paymentMethod = extensionInfo.paymentMethod || bookingData.paymentMethod || 'unknown';
            const isCardPayment = paymentMethod.toLowerCase().includes('card');
            const isPayNowPayment = paymentMethod.toLowerCase().includes('paynow') || paymentMethod.toLowerCase().includes('pay_now');

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text('Sub Total:', col4, totalsTop)
                .text(`SGD ${subtotal.toFixed(2)}`, col5, totalsTop);

            if (creditAmount > 0) {
                doc.fillColor('#000000')
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text('Credits Applied:', col4, totalsTop + 15)
                    .text(`-SGD ${creditAmount.toFixed(2)}`, col5, totalsTop + 15);
            }

            // Display payment fee if applicable
            if (paymentFee > 0) {
                const feeLabel = isCardPayment ? `Card Fee (${cardFeePercentage}%):` : 'Transaction Fee:';
                doc.fillColor('#000000')
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(feeLabel, col4, totalsTop + (creditAmount > 0 ? 30 : 15))
                    .text(`SGD ${paymentFee.toFixed(2)}`, col5, totalsTop + (creditAmount > 0 ? 30 : 15));
            }

            const hasFee = paymentFee > 0;

            doc.fillColor('#000000')
                .font(headerFont).fontSize(bodyFontSize)
                .text('Total:', col4, totalsTop + (creditAmount > 0 ? (hasFee ? 45 : 35) : (hasFee ? 30 : 15)))
                .text(`SGD ${finalTotal.toFixed(2)}`, col5, totalsTop + (creditAmount > 0 ? (hasFee ? 45 : 35) : (hasFee ? 30 : 15)));

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text('Paid:', col4, totalsTop + (creditAmount > 0 ? (hasFee ? 60 : 50) : (hasFee ? 45 : 30)))
                .text(`SGD ${finalTotal.toFixed(2)}`, col5, totalsTop + (creditAmount > 0 ? (hasFee ? 60 : 50) : (hasFee ? 45 : 30)));

            // Footer
         
            doc.end();

            doc.on('end', () => {
                resolve({ filePath, fileName });
            });

            doc.on('error', (error) => {
                console.error('PDF generation error:', error);
                reject(error);
            });

        } catch (error) {
            console.error('Extension invoice generation error:', error);
            reject(error);
        }
    });
};

const generateRescheduleInvoicePDF = (userData, bookingData, rescheduleInfo) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Get dynamic payment fee settings
            const { getPaymentSettings } = require('./paymentFeeHelper');
            const feeSettings = await getPaymentSettings();
            const cardFeePercentage = feeSettings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
            
            const doc = new PDFDocument({ margin: 50, size: 'A4' });

            const fileName = `Reschedule_Invoice_${bookingData.bookingRef || bookingData.id || Date.now()}.pdf`;
            const filePath = path.join('/tmp', fileName);

            const tempDir = path.dirname(filePath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            doc.pipe(fs.createWriteStream(filePath));

            const headerFont = 'Helvetica-Bold';
            const bodyFont = 'Helvetica';
            const titleFontSize = 18;
            const sectionHeaderFontSize = 12;
            const bodyFontSize = 10;
            const smallFontSize = 8;

            // Logo
            try {
                const logoPath = path.join(process.cwd(), "public", "logo.png");
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 60, 60, { width: 150, height: 60 });
                } else {
                    doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
                }
            } catch (logoError) {
                doc.font(headerFont).fontSize(titleFontSize).text("MY PRODUCTIVE SPACE", 60, 60);
            }

            // Company details
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(smallFontSize)
                .text('My Productive Space', 60, 130)  
                .text('Company ID: 53502976D', 60, 140)  
                .text('Blk 208 Hougang st 21 #01-201', 60, 150)  
                .text('Hougang 530208', 60, 160)  
                .text('Singapore', 60, 170)  
                .text('Tel: 89202462', 60, 180);

            // Bill To section
            doc.fillColor('#000000')
                .font(headerFont).fontSize(sectionHeaderFontSize)
                .text('Bill To', 400, 130);

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text(userData.email || 'N/A', 400, 150);

            // Invoice title
            doc.fillColor('#000000')
                .font(headerFont).fontSize(titleFontSize)
                .text('BOOKING RESCHEDULE INVOICE', 60, 220);

            // Reschedule details
            const originalStartDate = new Date(rescheduleInfo.originalStartAt);
            const originalEndDate = new Date(rescheduleInfo.originalEndAt);
            const newStartDate = new Date(rescheduleInfo.newStartAt);
            const newEndDate = new Date(rescheduleInfo.newEndAt);
            
            const formatDate = (date) => {
                return formatForInvoice(date).date;
            };

            const formatTime = (date) => {
                return formatForInvoice(date).time;
            };

            // Reschedule summary
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`Reference: ${bookingData.bookingRef || 'N/A'}`, 60, 260)
                .text(`Location: ${bookingData.location || 'N/A'}`, 60, 275)
                .text(`Reschedule Date: ${formatDate(newStartDate)}`, 60, 290)
                .text(`Original Time: ${formatTime(originalStartDate)} - ${formatTime(originalEndDate)}`, 60, 305)
                .text(`New Time: ${formatTime(newStartDate)} - ${formatTime(newEndDate)}`, 60, 320)
                .text(`Additional Hours: ${rescheduleInfo.additionalHours || 0}`, 60, 335);

            // Table header
            const tableTop = 360;
            const col1 = 60;
            const col2 = 120;
            const col3 = 250;
            const col4 = 320;
            const col5 = 420;
            const col6 = 500;

            doc.fillColor('#333333')
                .rect(col1, tableTop, col6 - col1, 20)
                .fill();

            doc.fillColor('#FFFFFF')
                .font(headerFont).fontSize(bodyFontSize)
                .text('#', col1 + 5, tableTop + 5)
                .text('Description', col2, tableTop + 5)
                .text('Hours', col3, tableTop + 5)
                .text('Rate', col4, tableTop + 5)
                .text('Amount', col5, tableTop + 5);

            // Reschedule item row
            const itemTop = tableTop + 20;
            doc.fillColor('#F8F8F8')
                .rect(col1, itemTop, col6 - col1, 20)
                .fill();

            const additionalHours = rescheduleInfo.additionalHours || 0;
            const ratePerHour = bookingData.memberType === 'STUDENT' ? 4.00 : 
                               bookingData.memberType === 'TUTOR' ? 6.00 : 5.00;
            const additionalAmount = rescheduleInfo.additionalCost || 0;

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text('1', col1 + 5, itemTop + 5)
                .text(`Reschedule - ${bookingData.location}`, col2, itemTop + 5)
                .text(`${additionalHours.toFixed(2)}`, col3, itemTop + 5)
                .text(`$${ratePerHour.toFixed(2)}`, col4, itemTop + 5)
                .text(`$${additionalAmount.toFixed(2)}`, col5, itemTop + 5);

            // Role & Seat Information
            const roleTop = itemTop + 40;
            doc.fillColor('#000000')
                .font(headerFont).fontSize(bodyFontSize)
                .text('Role & Seat Information', 60, roleTop);

            const memberTypeText = bookingData.memberType === 'STUDENT' ? 'Student(s)' : 
                                  bookingData.memberType === 'TUTOR' ? 'Tutor(s)' : 'Member(s)';

            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text(`Total: ${bookingData.pax || 1} ${memberTypeText}`, 60, roleTop + 20)
                .text(`Assigned Seats: ${(bookingData.seatNumbers || []).join(', ') || 'N/A'}`, 60, roleTop + 35);

            // Totals section
            const totalsTop = roleTop + 80;
            const baseAmount = rescheduleInfo.additionalCost || 0;
            const creditAmount = rescheduleInfo.creditAmount || 0;
            const subtotal = baseAmount - creditAmount;
            const paymentFee = rescheduleInfo.paymentFee || 0;
            const finalAmount = rescheduleInfo.finalAmount || subtotal + paymentFee;

            // Base amount
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text('Additional Cost:', col4, totalsTop)
                .text(`SGD ${baseAmount.toFixed(2)}`, col5, totalsTop);

            // Credits applied (if any)
            if (creditAmount > 0) {
                doc.fillColor('#28a745')
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text('Credits Applied:', col4, totalsTop + 15)
                    .text(`- SGD ${creditAmount.toFixed(2)}`, col5, totalsTop + 15);
            }

            // Subtotal
            const subtotalTop = creditAmount > 0 ? totalsTop + 30 : totalsTop + 15;
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text('Sub Total:', col4, subtotalTop)
                .text(`SGD ${subtotal.toFixed(2)}`, col5, subtotalTop);

            // Payment fee (if any)
            if (paymentFee > 0) {
                doc.fillColor('#000000')
                    .font(bodyFont).fontSize(bodyFontSize)
                    .text(`${rescheduleInfo.paymentMethod} Fee:`, col4, subtotalTop + 15)
                    .text(`SGD ${paymentFee.toFixed(2)}`, col5, subtotalTop + 15);
            }

            // Total
            const totalTop = paymentFee > 0 ? subtotalTop + 30 : subtotalTop + 15;
            doc.fillColor('#000000')
                .font(headerFont).fontSize(bodyFontSize)
                .text('Total:', col4, totalTop)
                .text(`SGD ${finalAmount.toFixed(2)}`, col5, totalTop);

            // Paid
            doc.fillColor('#000000')
                .font(bodyFont).fontSize(bodyFontSize)
                .text('Paid:', col4, totalTop + 15)
                .text(`SGD ${finalAmount.toFixed(2)}`, col5, totalTop + 15);

            doc.end();

            doc.on('end', () => {
                resolve({ filePath, fileName });
            });

            doc.on('error', (error) => {
                console.error('PDF generation error:', error);
                reject(error);
            });

        } catch (error) {
            console.error('Reschedule invoice generation error:', error);
            reject(error);
        }
    });
};

module.exports = {
    generateInvoicePDF,
    generateExtensionInvoicePDF,
    generateRescheduleInvoicePDF
};