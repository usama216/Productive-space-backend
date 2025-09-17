const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');
const { paymentConfirmationTemplate, bookingConfirmationTemplate } = require("../templates/bookingConfirmation");
const { generateInvoicePDF } = require("./invoice"); 

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

module.exports = { 
  sendEmail, 
  sendBookingConfirmation,
  sendPaymentConfirmation 
};