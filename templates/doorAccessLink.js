const { formatSingaporeDateTime, formatSingaporeDate, formatSingaporeTime, getCurrentSingaporeDateTime } = require('../utils/timezoneUtils');

/**
 * Generate HTML template for door access link email
 * @param {Object} data - Email data containing access link and booking details
 * @param {string} data.accessLink - The generated access link
 * @param {string} data.bookingRef - Booking reference
 * @param {string} data.userName - User's name
 * @param {string} data.userEmail - User's email
 * @param {string} data.startTime - Booking start time
 * @param {string} data.endTime - Booking end time
 * @param {string} data.location - Booking location
 * @param {string} data.expiresAt - Link expiration time
 * @returns {string} HTML template
 */
const doorAccessLinkTemplate = (data) => {
  const {
    accessLink,
    bookingRef,
    userName,
    userEmail,
    startTime,
    endTime,
    location,
    expiresAt
  } = data;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Door Access Link - My Productive Space</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0; 
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white; 
          border-radius: 15px; 
          box-shadow: 0 10px 30px rgba(0,0,0,0.1); 
          overflow: hidden;
        }
        .header { 
          background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); 
          color: white; 
          padding: 30px; 
          text-align: center; 
        }
        .access-icon {
          font-size: 48px;
          margin-bottom: 15px;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .content { 
          padding: 30px; 
        }
        .welcome-message {
          text-align: center;
          margin-bottom: 30px;
        }
        .welcome-message h1 {
          color: #ff6b35;
          margin-bottom: 10px;
          font-size: 28px;
        }
        .welcome-message p {
          color: #666;
          font-size: 16px;
        }
        .access-button {
          text-align: center;
          margin: 30px 0;
        }
        .access-button a {
          display: inline-block;
          background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 50px;
          font-weight: 600;
          font-size: 18px;
          box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
          transition: all 0.3s ease;
        }
        .access-button a:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255, 107, 53, 0.4);
        }
        .booking-details {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .booking-details h3 {
          color: #495057;
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 18px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #495057;
        }
        .detail-value {
          color: #6c757d;
          font-family: 'Courier New', monospace;
        }
        .important-notice {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .important-notice h3 {
          color: #856404;
          margin-top: 0;
          margin-bottom: 10px;
        }
        .important-notice p {
          color: #856404;
          margin: 5px 0;
        }
        .footer { 
          text-align: center; 
          padding: 20px; 
          background: #f8f9fa;
          color: #6c757d; 
          font-size: 14px; 
        }
        .timestamp {
          background: #e3f2fd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        .timestamp .date {
          font-size: 18px;
          font-weight: 600;
          color: #1976d2;
        }
        .timestamp .time {
          font-size: 14px;
          color: #666;
        }
        .link-backup {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          word-break: break-all;
        }
        .link-backup p {
          margin: 0 0 10px 0;
          font-weight: 600;
          color: #495057;
        }
        .link-backup a {
          color: #007bff;
          text-decoration: none;
        }
        .link-backup a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="access-icon">🔑</div>
          <h1>Door Access Link</h1>
          <p>Your secure access to My Productive Space</p>
        </div>
        
        <div class="content">
          <div class="welcome-message">
            <h1>Hello ${userName}!</h1>
            <p>Your door access link has been generated successfully. Click the button below to unlock the door.</p>
          </div>

          <div class="access-button">
            <a href="${accessLink}" target="_blank">🔓 Open Door</a>
          </div>

          <div class="timestamp">
            <div class="date">${getCurrentSingaporeDateTime().date}</div>
            <div class="time">${getCurrentSingaporeDateTime().time}</div>
          </div>

          <div class="booking-details">
            <h3>📅 Booking Details</h3>
            <div class="detail-row">
              <span class="detail-label">Booking Reference:</span>
              <span class="detail-value">${bookingRef}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${location}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Start Time:</span>
              <span class="detail-value">${startTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">End Time:</span>
              <span class="detail-value">${endTime}</span>
            </div>
          
          </div>

          <div class="important-notice">
            <h3>⚠️ Important Information</h3>
            <p>• This link is valid only for your current booking session</p>
            <p>• The link will expire automatically after your booking ends</p>
            <p>• Keep this email safe and do not share the access link</p>
            <p>• If you have any issues, contact our support team</p>
          </div>

          <div class="link-backup">
            <p>Backup Access Link (if button doesn't work):</p>
            <a href="${accessLink}" target="_blank">${accessLink}</a>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #ff6b35; font-weight: 600; font-size: 16px;">
              🎉 Enjoy your time at My Productive Space!
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
          <p>This is an automated email from our smart lock system.</p>
          <p>If you didn't request this access link, please contact support immediately.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  doorAccessLinkTemplate
};
