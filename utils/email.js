// const nodemailer = require("nodemailer");
// const { paymentConfirmationTemplate, bookingConfirmationTemplate } = require("../templates/bookingConfirmation")

// // Configure transporter
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD
//   }
// });

// // Generic send function
// const sendEmail = async (to, templateFn, userData, bookingData) => {
//   try {
//     const emailContent = templateFn(userData, bookingData);

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to,
//       subject: emailContent.subject,
//       html: emailContent.html
//     };

//     const info = await transporter.sendMail(mailOptions);
//     console.log("✅ Email sent:", info.messageId);
//     return { success: true, messageId: info.messageId };
//   } catch (error) {
//     console.error("❌ Email error:", error.message);
//     return { success: false, error: error.message };
//   }
// };

// const sendPaymentConfirmation = (userData, bookingData) => {
//   return sendEmail(userData.email, paymentConfirmationTemplate, userData, bookingData);
// };

// const sendBookingConfirmation = (userData, bookingData) => {
//   return sendEmail(userData.email, bookingConfirmationTemplate, userData, bookingData);
// };


// module.exports = { sendEmail, sendBookingConfirmation,sendPaymentConfirmation };


// services/emailService.js - UPDATE YOUR EXISTING FILE
const nodemailer = require("nodemailer");
const fs = require('fs');
const { paymentConfirmationTemplate, bookingConfirmationTemplate } = require("../templates/bookingConfirmation");
const { generateInvoicePDF } = require("./invoice"); // ADD THIS IMPORT

// Configure transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Generic send function (KEEP AS IS)
const sendEmail = async (to, templateFn, userData, bookingData) => {
  try {
    const emailContent = templateFn(userData, bookingData);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email error:", error.message);
    return { success: false, error: error.message };
  }
};

// Payment confirmation (KEEP AS IS)
const sendPaymentConfirmation = (userData, bookingData) => {
  return sendEmail(userData.email, paymentConfirmationTemplate, userData, bookingData);
};

// REPLACE YOUR EXISTING sendBookingConfirmation WITH THIS:
const sendBookingConfirmation = async (userData, bookingData) => {
  try {
    // Generate PDF invoice
    const { filePath, fileName } = await generateInvoicePDF(userData, bookingData);
    
    // Get your existing email template
    const emailContent = bookingConfirmationTemplate(userData, bookingData);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userData.email,
      subject: emailContent.subject,
      html: emailContent.html,
      attachments: [
        {
          filename: fileName,
          path: filePath,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    
    // Clean up temporary file
    fs.unlinkSync(filePath);
    
    console.log("✅ Booking confirmation email with invoice sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Booking confirmation email error:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  sendEmail, 
  sendBookingConfirmation, // This now includes PDF attachment
  sendPaymentConfirmation 
};