const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');
const { paymentConfirmationTemplate, bookingConfirmationTemplate } = require("../templates/bookingConfirmation");
const { packageConfirmationTemplate } = require("../templates/packageConfirmation");
const { generateInvoicePDF } = require("./invoice");
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
    const emailContent = templateFn(userData, bookingData);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const sendPaymentConfirmation = (userData, bookingData) => {
  return sendEmail(userData.email, paymentConfirmationTemplate, userData, bookingData);
};

const sendBookingConfirmation = async (userData, bookingData) => {
  try {
    const { filePath, fileName } = await generateInvoicePDF(userData, bookingData);
    
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
        },
          {
          filename: 'logo.png',
          path: path.join(process.cwd(), 'public', 'logo.png'),
          cid: 'logo'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    
    fs.unlinkSync(filePath);    
    return { success: true, messageId: info.messageId };
  } catch (error) {
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
    console.error("❌ Error in sendPackageConfirmation:", error.message);
    console.error("❌ Error stack:", error.stack);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  sendEmail, 
  sendBookingConfirmation,
  sendPaymentConfirmation,
  sendPackageConfirmation
};