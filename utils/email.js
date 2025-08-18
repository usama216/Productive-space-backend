const nodemailer = require("nodemailer");
const bookingConfirmationTemplate = require("../templates/bookingConfirmation");

// Configure transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Generic send function
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

// Shortcut for booking confirmation
const sendBookingConfirmation = (userData, bookingData) => {
  return sendEmail(userData.email, bookingConfirmationTemplate, userData, bookingData);
};

module.exports = { sendEmail, sendBookingConfirmation };
