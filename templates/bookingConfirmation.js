const nodemailer = require('nodemailer');

// Create transporter (you'll need to configure these in your .env file)
const transporter = nodemailer.createTransporter({
  service: 'gmail', // or your preferred email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // Use app password for Gmail
  }
});

// Email templates
const emailTemplates = {
  bookingConfirmation: (userData, bookingData) => ({
    subject: `Booking Confirmed! Welcome to My Productive Space`,
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
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .highlight { color: #667eea; font-weight: bold; }
          .section { margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Booking Confirmed!</h1>
            <p>Welcome to My Productive Space</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.name},</h2>
            
            <p>Thank you for choosing My Productive Space! Your booking has been successfully confirmed and payment received.</p>
            
            <div class="booking-details">
              <h3>📋 Payment Details</h3>
              <p><strong>Reference Number:</strong> <span class="highlight">${bookingData.reference_number || 'N/A'}</span></p>
              <p><strong>Amount Paid:</strong> <span class="highlight">SGD ${bookingData.amount}</span></p>
              <p><strong>Payment Method:</strong> <span class="highlight">${bookingData.payment_method || 'Online Payment'}</span></p>
              <p><strong>Date:</strong> <span class="highlight">${new Date().toLocaleDateString('en-SG')}</span></p>
              <p><strong>Time:</strong> <span class="highlight">${new Date().toLocaleTimeString('en-SG')}</span></p>
            </div>

            ${bookingData.location || bookingData.date || bookingData.time ? `
            <div class="booking-details">
              <h3>Booking Details</h3>
              ${bookingData.location ? `<p><strong>Location:</strong> <span class="highlight">${bookingData.location}</span></p>` : ''}
              ${bookingData.date ? `<p><strong>Date:</strong> <span class="highlight">${bookingData.date}</span></p>` : ''}
              ${bookingData.time ? `<p><strong>Time:</strong> <span class="highlight">${bookingData.time}</span></p>` : ''}
              ${bookingData.duration ? `<p><strong>Duration:</strong> <span class="highlight">${bookingData.duration}</span></p>` : ''}
              ${bookingData.seats && bookingData.seats.length > 0 ? `<p><strong>Seats:</strong> <span class="highlight">${Array.isArray(bookingData.seats) ? bookingData.seats.join(', ') : bookingData.seats}</span></p>` : ''}
              ${bookingData.package ? `<p><strong>Package:</strong> <span class="highlight">${bookingData.package}</span></p>` : ''}
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
                <li>📧 Email: support@myproductivespace.com</li>
                <li>📱 WhatsApp: +65 9123 4567</li>
                <li>🌐 Website: www.myproductivespace.com</li>
              </ul>
            </div>
            
         
            
            <p><strong>Thank you for choosing My Productive Space!</strong></p>
            <p>We look forward to providing you with an excellent working environment.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 My Productive Space. All rights reserved.</p>
            <p>This email was sent to ${userData.email}</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Send email function
const sendEmail = async (to, template, data) => {
  try {
    const emailContent = emailTemplates[template](data.user, data.booking);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send booking confirmation email
const sendBookingConfirmation = async (userData, bookingData) => {
  return await sendEmail(userData.email, 'bookingConfirmation', { user: userData, booking: bookingData });
};

module.exports = {
  sendEmail,
  sendBookingConfirmation
};
