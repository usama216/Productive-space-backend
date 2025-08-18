// templates/emailTemplates.js

// Payment Confirmation Email
const paymentConfirmationTemplate = (userData, bookingData) => ({
  subject: `🎉 Payment Confirmed! Welcome to My Productive Space`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Payment Confirmation</title>
    </head>
    <body>
      <h2>Hello ${userData.name},</h2>
      <p>Your payment was successful!</p>

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

// Booking Confirmation Email
const bookingConfirmationTemplate = (userData, bookingData) => ({
  subject: `🎉 Booking Confirmation - Ref #${bookingData.bookingRef}`,
  html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Booking Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Hello ${userData.name || "Guest"},</h2>
      <p>✅ Your booking has been <strong>confirmed</strong> and payment received successfully.</p>

      <h3>📋 Booking Details</h3>
      <ul>
        <li><strong>Reference Number:</strong> ${bookingData.bookingRef}</li>
        <li><strong>Location:</strong> ${bookingData.location || "N/A"}</li>
        <li><strong>Seats:</strong> ${bookingData.seatNumbers?.join(", ") || "N/A"}</li>
        <li><strong>Number of People (PAX):</strong> ${bookingData.pax || "N/A"}</li>
        <li><strong>Start Time:</strong> ${new Date(bookingData.startAt).toLocaleString("en-SG")}</li>
        <li><strong>End Time:</strong> ${new Date(bookingData.endAt).toLocaleString("en-SG")}</li>
        <li><strong>Special Requests:</strong> ${bookingData.specialRequests || "None"}</li>
      </ul>

      <h3>💳 Payment Details</h3>
      <ul>
        <li><strong>Total Cost:</strong> SGD ${bookingData.totalCost || 0}</li>
        <li><strong>Discount Applied:</strong> ${bookingData.discountId || "N/A"}</li>
        <li><strong>Amount Paid:</strong> SGD ${bookingData.totalAmount || 0}</li>
        <li><strong>Payment ID:</strong> ${bookingData.paymentId || "N/A"}</li>
        <li><strong>Date:</strong> ${new Date().toLocaleDateString("en-SG")}</li>
        <li><strong>Time:</strong> ${new Date().toLocaleTimeString("en-SG")}</li>
      </ul>

      <p>We look forward to seeing you 🎉</p>
      <p style="margin-top:20px;">- The My Productive Space Team</p>
    </body>
    </html>
  `
});

module.exports = {
  paymentConfirmationTemplate,
  bookingConfirmationTemplate
};
