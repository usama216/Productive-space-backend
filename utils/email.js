const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');
const { paymentConfirmationTemplate, bookingConfirmationTemplate, extensionConfirmationTemplate, rescheduleConfirmationTemplate } = require("../templates/bookingConfirmation");
const { packageConfirmationTemplate } = require("../templates/packageConfirmation");
const { refundConfirmationTemplate } = require("../templates/refundConfirmation");
const { generateInvoicePDF, generateExtensionInvoicePDF, generateRescheduleInvoicePDF } = require("./invoice");
const { generatePackageInvoicePDF } = require("./packageInvoice"); 

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendEmail = async (to, templateFn, userData, bookingData) => {
  try {
    console.log('📧 [DEBUG] Starting sendEmail...');
    console.log('📧 [DEBUG] To:', to);
    console.log('📧 [DEBUG] UserData:', userData);
    console.log('📧 [DEBUG] BookingData:', bookingData);
    
    const emailContent = templateFn(userData, bookingData);
    console.log('📧 [DEBUG] Email content generated:', emailContent.subject);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    console.log('📧 [DEBUG] Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 [DEBUG] Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('📧 [DEBUG] Email error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendRawEmail = async (emailData) => {
  try {
    console.log('📧 [DEBUG] Starting sendRawEmail...');
    console.log('📧 [DEBUG] Email data:', emailData);
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html
    };

    console.log('📧 [DEBUG] Sending raw email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 [DEBUG] Raw email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('📧 [DEBUG] Raw email error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendPaymentConfirmation = (userData, bookingData) => {
  return sendEmail(userData.email, paymentConfirmationTemplate, userData, bookingData);
};

const sendBookingConfirmation = async (userData, bookingData) => {
  try {
    console.log('📧 [DEBUG] Starting sendBookingConfirmation...');
    console.log('📧 [DEBUG] UserData:', userData);
    console.log('📧 [DEBUG] BookingData:', bookingData);
    
    console.log('📧 [DEBUG] Generating invoice PDF...');
    const { filePath, fileName } = await generateInvoicePDF(userData, bookingData);
    console.log('📧 [DEBUG] PDF generated:', fileName);
    
    console.log('📧 [DEBUG] Creating email content...');
    const emailContent = bookingConfirmationTemplate(userData, bookingData);
    console.log('📧 [DEBUG] Email content created:', emailContent.subject);

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
        },
        {
          filename: 'logo.png',
          path: path.join(process.cwd(), 'public', 'logo.png'),
          cid: 'logo'
        }
      ]
    };

    console.log('📧 [DEBUG] Sending booking confirmation email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('📧 [DEBUG] Booking confirmation email sent:', info.messageId);
    
    fs.unlinkSync(filePath);    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('📧 [DEBUG] Booking confirmation error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendPackageConfirmation = async (userData, packageData) => {
  try {
    console.log("📄 Generating package invoice PDF...");
    const { filePath, fileName } = await generatePackageInvoicePDF(userData, packageData);
    console.log("✅ PDF generated:", fileName);
    
    console.log("📝 Creating email content...");
    const emailContent = packageConfirmationTemplate(userData, packageData);
    console.log("✅ Email content created, subject:", emailContent.subject);

    console.log("📎 Preparing email attachments...");
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoExists = fs.existsSync(logoPath);
    console.log("🖼️ Logo file exists:", logoExists, "at:", logoPath);

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
        },
        ...(logoExists ? [{
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo'
        }] : [])
      ]
    };

    console.log("📧 Sending email via Gmail SMTP...");
    console.log("📧 From:", process.env.EMAIL_USER);
    console.log("📧 To:", userData.email);
    console.log("📧 Attachments:", mailOptions.attachments.length);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log("🗑️ Cleaning up temporary PDF file...");
    fs.unlinkSync(filePath);
    console.log("✅ Temporary file deleted:", filePath);
    
    console.log("✅ Package confirmation email sent successfully!");
    console.log("📧 Message ID:", info.messageId);
    console.log("📧 Response:", info.response);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error in sendPackageConfirmation:", error);
    return { success: false, error: error.message };
  }
};

const sendRefundConfirmation = async (data) => {
  try {
    const { user, booking, creditAmount, expiresAt } = data;
    
    console.log("📧 Sending refund confirmation email to:", user.email);
    
    const emailContent = refundConfirmationTemplate({
      user,
      booking,
      creditAmount,
      expiresAt
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Refund Confirmed - ${booking.bookingRef} | StudySpace`,
      html: emailContent
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Refund confirmation email sent successfully:", result.messageId);
    return result;
  } catch (error) {
    console.error("❌ Error sending refund confirmation email:", error);
    throw error;
  }
};

const sendExtensionConfirmation = async (userData, bookingData, extensionInfo) => {
  try {
    console.log("📄 Generating extension invoice PDF...");
    const { filePath, fileName } = await generateExtensionInvoicePDF(userData, bookingData, extensionInfo);
    console.log("✅ PDF generated:", fileName);
    
    console.log("📝 Creating extension email content...");
    const emailContent = extensionConfirmationTemplate(userData, bookingData, extensionInfo);
    console.log("✅ Email content created, subject:", emailContent.subject);

    console.log("📎 Preparing email attachments...");
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoExists = fs.existsSync(logoPath);
    console.log("🖼️ Logo file exists:", logoExists, "at:", logoPath);

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
        },
        ...(logoExists ? [{
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo'
        }] : [])
      ]
    };

    console.log("📧 Sending extension confirmation email via Gmail SMTP...");
    console.log("📧 From:", process.env.EMAIL_USER);
    console.log("📧 To:", userData.email);
    console.log("📧 Attachments:", mailOptions.attachments.length);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log("🗑️ Cleaning up temporary PDF file...");
    fs.unlinkSync(filePath);
    console.log("✅ Temporary file deleted:", filePath);
    
    console.log("✅ Extension confirmation email sent successfully!");
    console.log("📧 Message ID:", info.messageId);
    console.log("📧 Response:", info.response);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error in sendExtensionConfirmation:", error);
    return { success: false, error: error.message };
  }
};

const sendRescheduleConfirmation = async (userData, bookingData, rescheduleInfo) => {
  try {
    console.log("📄 Generating reschedule invoice PDF...");
    const { filePath, fileName } = await generateRescheduleInvoicePDF(userData, bookingData, rescheduleInfo);
    console.log("✅ PDF generated:", fileName);
    
    console.log("📝 Creating reschedule email content...");
    const emailContent = rescheduleConfirmationTemplate(userData, bookingData, rescheduleInfo);
    console.log("✅ Email content created, subject:", emailContent.subject);

    console.log("📎 Preparing email attachments...");
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoExists = fs.existsSync(logoPath);
    console.log("🖼️ Logo file exists:", logoExists, "at:", logoPath);

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
        },
        ...(logoExists ? [{
          filename: 'logo.png',
          path: logoPath,
          cid: 'logo'
        }] : [])
      ]
    };

    console.log("📧 Sending reschedule confirmation email via Gmail SMTP...");
    console.log("📧 From:", process.env.EMAIL_USER);
    console.log("📧 To:", userData.email);
    console.log("📧 Attachments:", mailOptions.attachments.length);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log("🗑️ Cleaning up temporary PDF file...");
    fs.unlinkSync(filePath);
    console.log("✅ Temporary file deleted:", filePath);
    
    console.log("✅ Reschedule confirmation email sent successfully!");
    console.log("📧 Message ID:", info.messageId);
    console.log("📧 Response:", info.response);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error in sendRescheduleConfirmation:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendRawEmail,
  sendPaymentConfirmation,
  sendBookingConfirmation,
  sendPackageConfirmation,
  sendRefundConfirmation,
  sendExtensionConfirmation,
  sendRescheduleConfirmation
};