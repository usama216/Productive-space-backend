module.exports = (userData, bookingData) => ({
  subject: `🎉 Booking Confirmed! Welcome to My Productive Space`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Booking Confirmation</title>
    </head>
    <body>
      <h2>Hello ${userData.name},</h2>
      <p>Thank you for booking with us!</p>

      <h3>📋 Payment Details</h3>
      <p><strong>Reference Number:</strong> ${bookingData.reference_number || 'N/A'}</p>
      <p><strong>Amount Paid:</strong> SGD ${bookingData.amount}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-SG')}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleTimeString('en-SG')}</p>


      <p>We look forward to seeing you 🎉</p>
    </body>
    </html>
  `
});
