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

module.exports = {
  paymentConfirmationTemplate,
  bookingConfirmationTemplate
};