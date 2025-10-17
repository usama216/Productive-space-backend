const { formatSingaporeDateTime, formatSingaporeDate } = require('../utils/timezoneUtils');

const refundConfirmationTemplate = (data) => {
  const { user, booking, creditAmount, expiresAt } = data;
  
  const formatDate = (dateString) => {
    return formatSingaporeDateTime(dateString);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'SGD'
    }).format(amount);
  };

  const expiryDate = formatDate(expiresAt);
  const creditAmountFormatted = formatCurrency(creditAmount);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Refund Confirmation</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .title {
            color: #059669;
            font-size: 24px;
            margin: 0;
        }
        .content {
            margin-bottom: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #1f2937;
        }
        .refund-details {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-row:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 18px;
            color: #059669;
        }
        .detail-label {
            font-weight: 600;
            color: #374151;
        }
        .detail-value {
            color: #1f2937;
        }
        .credit-info {
            background-color: #ecfdf5;
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .credit-amount {
            font-size: 32px;
            font-weight: bold;
            color: #059669;
            margin: 10px 0;
        }
        .expiry-warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }
        .warning-text {
            color: #92400e;
            font-weight: 600;
            margin: 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
        }
        .footer-text {
            margin: 5px 0;
        }
        .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
        }
        .button:hover {
            background-color: #1d4ed8;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">StudySpace</div>
            <h1 class="title">Refund Confirmed</h1>
        </div>
        
        <div class="content">
            <div class="greeting">
                Hello ${user.firstName || 'Valued Customer'},
            </div>
            
            <p>Your refund request has been approved and processed successfully. The refunded amount has been added to your account as store credit.</p>
            
            <div class="refund-details">
                <h3 style="margin-top: 0; color: #1f2937;">Refund Details</h3>
                <div class="detail-row">
                    <span class="detail-label">Booking Reference:</span>
                    <span class="detail-value">${booking.bookingRef}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Original Booking Date:</span>
                    <span class="detail-value">${formatSingaporeDateTime(booking.startAt)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${booking.location}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Refund Amount:</span>
                    <span class="detail-value">${creditAmountFormatted}</span>
                </div>
            </div>
            
            <div class="credit-info">
                <h3 style="margin-top: 0; color: #059669;">Store Credit Added</h3>
                <div class="credit-amount">${creditAmountFormatted}</div>
                <p style="margin: 10px 0; color: #374151;">This credit has been added to your account and can be used for future bookings.</p>
            </div>
            
            <div class="expiry-warning">
                <p class="warning-text">⚠️ Important: Store credits expire on ${expiryDate}</p>
                <p style="margin: 5px 0; color: #92400e; font-size: 14px;">Please use your credits before the expiry date to avoid losing them.</p>
            </div>
            
            <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">
                    View My Credits
                </a>
            </div>
            
            <p>You can use these credits for future bookings by selecting the "Use Store Credit" option during checkout. The credit will be automatically applied to reduce your payment amount.</p>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        </div>
        
        <div class="footer">
            <p class="footer-text">Thank you for choosing StudySpace!</p>
            <p class="footer-text">This is an automated message. Please do not reply to this email.</p>
            <p class="footer-text">© ${new Date().getFullYear()} StudySpace. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
};

module.exports = { refundConfirmationTemplate };
