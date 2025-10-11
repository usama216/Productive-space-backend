// templates/emailTemplates.js

const paymentConfirmationTemplate = (userData, bookingData) => ({
  subject: `Payment Confirmed! Welcome to My Productive Space`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payment Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6900 0%, #ff8533 100%); color: white; padding: 20px 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .logo-container { text-align: center; margin-bottom: 20px; }
        .logo { max-width: 120px; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            <img src="cid:logo" alt="My Productive Space Logo" class="logo">
          </div>
          <h1>Payment Confirmed!</h1>
          <p>Welcome to My Productive Space</p>
        </div>
        
        <div class="content">
          <h2>Hello ${userData.name},</h2>
          <p>Your payment was successful!</p>

          <h3>📋 Payment Details</h3>
          <p><strong>Reference Number:</strong> ${bookingData.reference_number || 'N/A'}</p>
          <p><strong>Amount Paid:</strong> SGD ${bookingData.amount}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-SG')}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleTimeString('en-SG')}</p>

          <p>We look forward to seeing you 🎉</p>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
});

const bookingConfirmationTemplate = (userData, bookingData) => ({
  subject: `Booking Confirmed - Ref #${bookingData.bookingRef || 'N/A'} - Welcome to My Productive Space`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6900 0%, #ff8533 100%); color: white; padding: 6px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .logo-container { text-align: center; margin-bottom: 20px; }
        .logo { max-width: 220px; height: auto; border-radius: 0px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ff6900; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #ff6900; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .highlight { color: #ff6900; font-weight: bold; }
        .section { margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            <img src="cid:logo" alt="My Productive Space Logo" class="logo">
          </div>
          <h3>Booking Confirmed!</h3>
         
        </div>
        
        <div class="content">
          <h2>Hello ${userData.firstName + userData.lastName || "Guest"},</h2>
          
          <p>Thank you for choosing My Productive Space! Your booking has been successfully confirmed and payment received.</p>
          
          <div class="booking-details">
            <h3>📋 Payment Details</h3>
            <p><strong>Reference Number:</strong> <span class="highlight">${bookingData.bookingRef || 'N/A'}</span></p>
            
            ${(() => {
              const { calculatePaymentDetails } = require('../utils/calculationHelper');
              const paymentDetails = calculatePaymentDetails(bookingData);
              
              // Package and credit information will be displayed in email
              
              let displayPaymentMethod = 'Unknown';
              if (bookingData.paymentMethod) {
                  displayPaymentMethod = bookingData.paymentMethod;
              } else if (bookingData.paymentDetails && bookingData.paymentDetails.paymentMethod) {
                  displayPaymentMethod = bookingData.paymentDetails.paymentMethod;
              }
              
              if (displayPaymentMethod === 'paynow_online') {
                  displayPaymentMethod = 'Pay Now';
              } else if (displayPaymentMethod === 'credit_card' || displayPaymentMethod === 'card') {
                  displayPaymentMethod = 'Credit Card';
              }
              
              return `
                <p><strong>Original Amount:</strong> <span class="highlight">SGD ${paymentDetails.originalAmount.toFixed(2)}</span></p>
                ${paymentDetails.discount && paymentDetails.discount.discountAmount > 0 ? `
                  <p><strong>Discount Applied:</strong> <span class="highlight">-SGD ${paymentDetails.discount.discountAmount.toFixed(2)}</span></p>
                  ${paymentDetails.promoCodeId ? `<p><strong>Promo Code:</strong> <span class="highlight">${paymentDetails.promoCodeId}</span></p>` : ''}
                ` : ''}
                ${bookingData.packageDiscountAmount && bookingData.packageDiscountAmount > 0 ? `
                  <p><strong>Package Applied:</strong> <span class="highlight">-SGD ${(parseFloat(bookingData.totalAmount) === 0 ? parseFloat(bookingData.totalCost) || 0 : parseFloat(bookingData.packageDiscountAmount) || 0).toFixed(2)}</span></p>
                  ${bookingData.packageName ? `<p><strong>Package:</strong> <span class="highlight">${bookingData.packageName}</span></p>` : ''}
                  ${bookingData.packageDiscountId ? `<p><strong>Package ID:</strong> <span class="highlight">${bookingData.packageDiscountId}</span></p>` : ''}
                ` : ''}
                ${bookingData.creditAmount && bookingData.creditAmount > 0 ? `
                  <p><strong>Credits Applied:</strong> <span class="highlight">-SGD ${parseFloat(bookingData.creditAmount).toFixed(2)}</span></p>
                ` : ''}
                ${paymentDetails.isCardPayment ? `<p><strong>Card Processing Fee (5%):</strong> <span class="highlight">SGD ${paymentDetails.cardFee.toFixed(2)}</span></p>` : ''}
                <p><strong>Total Amount Paid:</strong> <span class="highlight">SGD ${paymentDetails.finalTotal.toFixed(2)}</span></p>
                <p><strong>Payment Method:</strong> <span class="highlight">${displayPaymentMethod}</span></p>
              `;
            })()}
            
            <p><strong>Payment ID:</strong> <span class="highlight">${bookingData.paymentId || 'N/A'}</span></p>
            <p><strong>Date:</strong> <span class="highlight">${new Date().toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' })}</span></p>
            <p><strong>Time:</strong> <span class="highlight">${new Date().toLocaleTimeString('en-SG', { timeZone: 'Asia/Singapore' })}</span></p>
          </div>

          ${bookingData.location || bookingData.startAt || bookingData.endAt || bookingData.seatNumbers || bookingData.pax ? `
          <div class="booking-details">
            <h3>🏢 Booking Details</h3>
            ${bookingData.location ? `<p><strong>Location:</strong> <span class="highlight">${bookingData.location}</span></p>` : ''}
            ${(() => {
              const startAt = bookingData.startAt ? new Date(bookingData.startAt) : null;
              const endAt = bookingData.endAt ? new Date(bookingData.endAt) : null;
              
              if (startAt && endAt) {
                const startSGT = startAt.toLocaleString("en-SG", { 
                  timeZone: "Asia/Singapore",
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  weekday: 'long'
                });
                const endSGT = endAt.toLocaleString("en-SG", { 
                  timeZone: "Asia/Singapore",
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                return `
                  <p><strong>Start Time:</strong> <span class="highlight">${startSGT}</span></p>
                  <p><strong>End Time:</strong> <span class="highlight">${endSGT}</span></p>
                `;
              }
              return '';
            })()}
            ${bookingData.seatNumbers && bookingData.seatNumbers.length > 0 ? `<p><strong>Seats:</strong> <span class="highlight">${bookingData.seatNumbers.join(', ')}</span></p>` : ''}
            ${bookingData.pax ? `<p><strong>Number of People (PAX):</strong> <span class="highlight">${bookingData.pax}</span></p>` : ''}
            ${bookingData.specialRequests && bookingData.specialRequests !== "None" ? `<p><strong>Special Requests:</strong> <span class="highlight">${bookingData.specialRequests}</span></p>` : ''}
          </div>
          ` : ''}
          
          <div class="section">
            <h3>What's Next?</h3>
            <ul>
              <li>Check your email for additional booking details</li>
              <li>Arrive 10 minutes before your scheduled time</li>
              <li>Enjoy your productive time at our space!</li>
            </ul>
          </div>
          
          <div class="section">
            <h3>📞 Need Help?</h3>
            <p>If you have any questions or need to make changes to your booking, please don't hesitate to contact us:</p>
            <ul>
              <li>📧 Email: myproductivespacecontact@gmail.com</li>
              <li>📱 WhatsApp: +65 89202462</li>
              <li>🌐 Website: www.myproductivespace.com</li>
            </ul>
          </div>
          
          <p><strong>Thank you for choosing My Productive Space!</strong></p>
          <p>We look forward to providing you with an excellent working environment.</p>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
          <p>This email was sent to ${userData.email || userData.name || "you"}</p>
        </div>
      </div>
    </body>
    </html>
  `
});

const extensionConfirmationTemplate = (userData, bookingData, extensionInfo) => ({
  subject: `Booking Extended - Ref #${bookingData.bookingRef || 'N/A'} - My Productive Space`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Extension Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6900 0%, #ff8533 100%); color: white; padding: 6px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .logo-container { text-align: center; margin-bottom: 20px; }
        .logo { max-width: 220px; height: auto; border-radius: 0px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ff6900; }
        .extension-highlight { background: #fff8e6; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #ffc107; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #ff6900; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .highlight { color: #ff6900; font-weight: bold; }
        .section { margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            <img src="cid:logo" alt="My Productive Space Logo" class="logo">
          </div>
          <h3>✅ Booking Extended Successfully!</h3>
        </div>
        
        <div class="content">
          <h2>Hello ${userData.firstName || "Guest"},</h2>
          
          <p>Great news! Your booking has been successfully extended. Thank you for using My Productive Space!</p>
          
          <div class="extension-highlight">
            <h3>⏰ Extension Details</h3>
            <p><strong>Additional Hours:</strong> ${extensionInfo.extensionHours || 0} hour(s)</p>
            <p><strong>Extension Cost:</strong> SGD ${parseFloat(extensionInfo.extensionCost || 0).toFixed(2)}</p>
            ${extensionInfo.creditAmount && parseFloat(extensionInfo.creditAmount) > 0 ? 
              `<p><strong>Credits Applied:</strong> <span style="color: green;">-SGD ${parseFloat(extensionInfo.creditAmount).toFixed(2)}</span></p>
               <p><strong>Amount Paid:</strong> SGD ${(parseFloat(extensionInfo.extensionCost) - parseFloat(extensionInfo.creditAmount)).toFixed(2)}</p>` : 
              `<p><strong>Amount Paid:</strong> SGD ${parseFloat(extensionInfo.extensionCost || 0).toFixed(2)}</p>`}
            <p><strong>Original End Time:</strong> ${new Date(extensionInfo.originalEndAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</p>
            <p><strong>New End Time:</strong> <span class="highlight">${new Date(bookingData.endAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</span></p>
          </div>
          
          <div class="booking-details">
            <h3>📋 Updated Booking Details</h3>
            <p><strong>Reference Number:</strong> <span class="highlight">${bookingData.bookingRef || 'N/A'}</span></p>
            <p><strong>Location:</strong> ${bookingData.location || 'N/A'}</p>
            <p><strong>Start Time:</strong> ${new Date(bookingData.startAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</p>
            <p><strong>End Time:</strong> ${new Date(bookingData.endAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</p>
            ${bookingData.seatNumbers && bookingData.seatNumbers.length > 0 ? 
              `<p><strong>Seat Numbers:</strong> ${bookingData.seatNumbers.join(', ')}</p>` : ''}
            <p><strong>Number of People:</strong> ${bookingData.pax || 1}</p>
            <p><strong>Total Amount Paid:</strong> SGD ${parseFloat(bookingData.totalAmount || 0).toFixed(2)}</p>
          </div>

          <div class="section">
            <h3>📄 Invoice</h3>
            <p>Please find your updated invoice attached to this email for your records.</p>
          </div>

          <div class="section">
            <h3>📍 Location Details</h3>
            <p><strong>My Productive Space</strong></p>
            <p>Blk 208 Hougang St 21 #01-201</p>
            <p>Hougang 530208, Singapore</p>
            <p>📞 Contact: 89202462</p>
          </div>

          <div class="section">
            <h3>⚠️ Important Reminders</h3>
            <ul>
              <li>Please arrive on time to make the most of your extended booking.</li>
              <li>If you need further extensions, please contact us at least 30 minutes before your current end time.</li>
              <li>Credits used for extensions are non-refundable.</li>
            </ul>
          </div>

          <p style="margin-top: 30px;">If you have any questions or need assistance, please don't hesitate to contact us!</p>
          
          <p>Thank you for choosing My Productive Space! 🎉</p>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
          <p>📧 myproductivespacecontact@gmail.com | 📞 89202462</p>
        </div>
      </div>
    </body>
    </html>
  `
});

module.exports = {
  paymentConfirmationTemplate,
  bookingConfirmationTemplate,
  extensionConfirmationTemplate
};