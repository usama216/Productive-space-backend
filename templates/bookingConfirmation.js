// templates/emailTemplates.js
const { formatSingaporeDateTime, formatSingaporeDate, formatSingaporeTime, getCurrentSingaporeDateTime } = require('../utils/timezoneUtils');

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
          <p><strong>Date:</strong> ${getCurrentSingaporeDateTime().date}</p>
          <p><strong>Time:</strong> ${getCurrentSingaporeDateTime().time}</p>

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

const bookingConfirmationTemplate = (userData, bookingData) => {
  try {
    console.log('📧 [DEBUG] Creating booking confirmation template...');
    console.log('📧 [DEBUG] UserData:', userData);
    console.log('📧 [DEBUG] BookingData:', bookingData);
    
    const subject = `Booking Confirmed - Ref #${bookingData.bookingRef || 'N/A'} - Welcome to My Productive Space`;
    console.log('📧 [DEBUG] Subject:', subject);
    
    return {
      subject,
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
            <p><strong>Amount Paid:</strong> <span class="highlight">SGD ${Number(bookingData.totalAmount).toFixed(2)}</span></p>
            ${(() => {
              const displayPaymentMethod = bookingData.paymentMethod || 'N/A';
              return `
                <p><strong>Payment Method:</strong> <span class="highlight">${displayPaymentMethod}</span></p>
              `;
            })()}
            
            <p><strong>Payment ID:</strong> <span class="highlight">${bookingData.paymentId || 'N/A'}</span></p>
            <p><strong>Date:</strong> <span class="highlight">${getCurrentSingaporeDateTime().date}</span></p>
            <p><strong>Time:</strong> <span class="highlight">${getCurrentSingaporeDateTime().time}</span></p>
          </div>

          ${bookingData.location || bookingData.startAt || bookingData.endAt || bookingData.seatNumbers || bookingData.pax ? `
          <div class="booking-details">
            <h3>🏢 Booking Details</h3>
            ${bookingData.location ? `<p><strong>Location:</strong> <span class="highlight">${bookingData.location}</span></p>` : ''}
            ${(() => {
              if (bookingData.startAt && bookingData.endAt) {
                const startSGT = formatSingaporeDateTime(bookingData.startAt);
                const endSGT = formatSingaporeTime(bookingData.endAt);
                
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
              <li>Your booking is confirmed and ready to use</li>
              <li>Please arrive on time for your scheduled session</li>
              <li>Bring a valid ID for verification if required</li>
              <li>Enjoy your productive time at our space!</li>
            </ul>
          </div>
          
          <div class="section">
            <h3>📞 Need Help?</h3>
            <p>If you have any questions or need assistance, please don't hesitate to contact us:</p>
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
          <p>This email was sent to ${userData.email || userData.firstName || "you"}</p>
        </div>
      </div>
    </body>
    </html>
  `
    };
  } catch (error) {
    console.error('📧 [DEBUG] Booking confirmation template error:', error.message);
    return {
      subject: 'Booking Confirmed - My Productive Space',
      html: '<h1>Booking Confirmed</h1><p>Your booking has been confirmed.</p>'
    };
  }
};

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
          <h3>Booking Extended!</h3>
        </div>
        
        <div class="content">
          <h2>Hello ${userData.firstName || userData.lastName || "Guest"},</h2>
          
          <p>Your booking has been successfully extended! Thank you for choosing My Productive Space.</p>
          
          <div class="booking-details">
            <h3>📋 Extension Details</h3>
            <p><strong>Reference Number:</strong> <span class="highlight">${bookingData.bookingRef || 'N/A'}</span></p>
            <p><strong>Location:</strong> <span class="highlight">${bookingData.location || 'N/A'}</span></p>
            <p><strong>Extension Hours:</strong> <span class="highlight">${extensionInfo.extensionHours || 0} hours</span></p>
            <p><strong>Extension Cost:</strong> <span class="highlight">SGD ${Number(extensionInfo.extensionCost || 0).toFixed(2)}</span></p>
            ${extensionInfo.creditAmount && extensionInfo.creditAmount > 0 ? `<p><strong>Credits Applied:</strong> <span class="highlight" style="color: #10b981;">-SGD ${Number(extensionInfo.creditAmount).toFixed(2)}</span></p>` : ''}
            ${extensionInfo.paymentFee && extensionInfo.paymentFee > 0 ? `<p><strong>Payment Fee:</strong> <span class="highlight">SGD ${Number(extensionInfo.paymentFee).toFixed(2)}</span></p>` : ''}
            ${extensionInfo.finalAmount !== undefined ? `<p><strong>Amount Paid:</strong> <span class="highlight">SGD ${Number(extensionInfo.finalAmount).toFixed(2)}</span></p>` : ''}
            <p><strong>New End Time:</strong> <span class="highlight">${formatSingaporeDateTime(extensionInfo.newEndAt || bookingData.endAt)}</span></p>
          </div>

          <div class="section">
            <h3>What's Next?</h3>
            <ul>
              <li>Your extended booking is confirmed and ready to use</li>
              <li>Please note the new end time for your session</li>
              <li>Enjoy your extended productive time at our space!</li>
            </ul>
          </div>
          
          <p><strong>Thank you for choosing My Productive Space!</strong></p>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
});

const rescheduleConfirmationTemplate = (userData, bookingData, rescheduleInfo) => ({
  subject: `Booking Rescheduled - Ref #${bookingData.bookingRef || 'N/A'} - My Productive Space`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Reschedule Confirmation</title>
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
          <h3>Booking Rescheduled!</h3>
        </div>
        
        <div class="content">
          <h2>Hello ${userData.firstName || userData.lastName || "Guest"},</h2>
          
          <p>Your booking has been successfully rescheduled! Thank you for choosing My Productive Space.</p>
          
          <div class="booking-details">
            <h3>📋 Reschedule Details</h3>
            <p><strong>Reference Number:</strong> <span class="highlight">${bookingData.bookingRef || 'N/A'}</span></p>
            <p><strong>Location:</strong> <span class="highlight">${bookingData.location || 'N/A'}</span></p>
            <p><strong>Original Time:</strong> <span class="highlight">${formatSingaporeDateTime(rescheduleInfo.originalStartAt)} - ${formatSingaporeTime(rescheduleInfo.originalEndAt)}</span></p>
            <p><strong>New Time:</strong> <span class="highlight">${formatSingaporeDateTime(rescheduleInfo.newStartAt)} - ${formatSingaporeTime(rescheduleInfo.newEndAt)}</span></p>
            <p><strong>Additional Hours:</strong> <span class="highlight">${rescheduleInfo.additionalHours || 0} hours</span></p>
            <p><strong>Additional Cost:</strong> <span class="highlight">SGD ${Number(rescheduleInfo.additionalCost || 0).toFixed(2)}</span></p>
            ${rescheduleInfo.creditAmount > 0 ? `<p><strong>Credits Applied:</strong> <span class="highlight" style="color: #28a745;">- SGD ${Number(rescheduleInfo.creditAmount).toFixed(2)}</span></p>` : ''}
            <p><strong>Subtotal:</strong> <span class="highlight">SGD ${Number(rescheduleInfo.subtotal || 0).toFixed(2)}</span></p>
            ${rescheduleInfo.paymentFee > 0 ? `<p><strong>${rescheduleInfo.paymentMethod} Fee:</strong> <span class="highlight">SGD ${Number(rescheduleInfo.paymentFee).toFixed(2)}</span></p>` : ''}
            <p><strong>Total Paid:</strong> <span class="highlight" style="color: #ff6900; font-size: 16px;">SGD ${Number(rescheduleInfo.finalAmount || 0).toFixed(2)}</span></p>
          </div>

          <div class="section">
            <h3>What's Next?</h3>
            <ul>
              <li>Your rescheduled booking is confirmed and ready to use</li>
              <li>Please note the new time for your session</li>
              <li>Enjoy your productive time at our space!</li>
            </ul>
          </div>
          
          <p><strong>Thank you for choosing My Productive Space!</strong></p>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
});

module.exports = {
  paymentConfirmationTemplate,
  bookingConfirmationTemplate,
  extensionConfirmationTemplate,
  rescheduleConfirmationTemplate
};