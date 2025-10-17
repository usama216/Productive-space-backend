const { formatSingaporeDate, formatSingaporeTime, getCurrentSingaporeDateTime } = require('../utils/timezoneUtils');

const packageConfirmationTemplate = (userData, packageData) => ({
  subject: `Package Purchase Confirmed - ${packageData.packageName} - Welcome to My Productive Space`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Package Purchase Confirmation</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6900 0%, #ff8533 100%); color: white; padding: 6px 20px; text-align: center; border-radius: 10px 10px 0 0; }
        .logo-container { text-align: center; margin-bottom: 20px; }
        .logo { max-width: 220px; height: auto; border-radius: 0px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .package-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ff6900; }
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
          <h3>Package Purchase Confirmed!</h3>
        </div>
        
        <div class="content">
          <h2>Hello ${userData.firstName || userData.lastName || "Guest"},</h2>
          
          <p>Thank you for choosing My Productive Space! Your package has been successfully purchased and is ready to use.</p>
          
          <div class="package-details">
            <h3>📦 Package Details</h3>
            <p><strong>Package Name:</strong> <span class="highlight">${packageData.packageName}</span></p>
            <p><strong>Package Type:</strong> <span class="highlight">${packageData.packageType}</span></p>
            <p><strong>Target Role:</strong> <span class="highlight">${packageData.targetRole}</span></p>
            <p><strong>Total Passes:</strong> <span class="highlight">${packageData.passCount}</span></p>
            <p><strong>Hours Allowed:</strong> <span class="highlight">${packageData.hoursAllowed} hours</span></p>
            <p><strong>Validity:</strong> <span class="highlight">${packageData.validityDays} days</span></p>
            <p><strong>Activated On:</strong> <span class="highlight">${formatSingaporeDate(packageData.activatedAt)}</span></p>
            <p><strong>Expires On:</strong> <span class="highlight">${formatSingaporeDate(packageData.expiresAt)}</span></p>
          </div>

          <div class="package-details">
            <h3>📋 Payment Details</h3>
            <p><strong>Order ID:</strong> <span class="highlight">${packageData.orderId}</span></p>
            <p><strong>Base Amount:</strong> <span class="highlight">SGD ${parseFloat(packageData.baseAmount || packageData.totalAmount).toFixed(2)}</span></p>
            ${packageData.cardFee > 0 ? `<p><strong>Card Processing Fee (5%):</strong> <span class="highlight">SGD ${parseFloat(packageData.cardFee).toFixed(2)}</span></p>` : ''}
            <p><strong>Total Amount Paid:</strong> <span class="highlight">SGD ${parseFloat(packageData.totalAmount).toFixed(2)}</span></p>
            <p><strong>Payment Method:</strong> <span class="highlight">${packageData.paymentMethod}</span></p>
            <p><strong>Purchase Date:</strong> <span class="highlight">${formatSingaporeDate(packageData.purchasedAt)}</span></p>
            <p><strong>Purchase Time:</strong> <span class="highlight">${formatSingaporeTime(packageData.purchasedAt)}</span></p>
          </div>
          
          <div class="section">
            <h3>What's Next?</h3>
            <ul>
              <li>Your package is now active and ready to use</li>
              <li>Book your workspace sessions using your package passes</li>
              <li>Each pass gives you ${packageData.hoursAllowed} hours of workspace access</li>
              <li>Enjoy your productive time at our space!</li>
            </ul>
          </div>
          
          <div class="section">
            <h3>📞 Need Help?</h3>
            <p>If you have any questions about your package or need assistance, please don't hesitate to contact us:</p>
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
});

module.exports = { packageConfirmationTemplate };
