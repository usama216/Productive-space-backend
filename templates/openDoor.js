const { formatSingaporeDateTime, formatSingaporeDate, formatSingaporeTime, getCurrentSingaporeDateTime } = require('../utils/timezoneUtils');

/**
 * Generate HTML template for successful door opening
 * @param {string} startTime - Booking start time
 * @param {string} endTime - Booking end time
 * @returns {string} HTML template
 */
const openDoorSuccessTemplate = (startTime, endTime) => {
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Door Opened Successfully</title>
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
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
          color: white; 
          padding: 30px; 
          text-align: center; 
        }
        .success-icon {
          font-size: 48px;
          margin-bottom: 15px;
          animation: bounce 2s infinite;
        }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        .content { 
          padding: 30px; 
        }
        .success-message {
          text-align: center;
          margin-bottom: 30px;
        }
        .success-message h1 {
          color: #28a745;
          margin-bottom: 10px;
          font-size: 28px;
        }
        .success-message p {
          color: #666;
          font-size: 16px;
        }
        .details {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .details h3 {
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">🔓</div>
          <h1>Door Opened Successfully!</h1>
          <p>Access granted to My Productive Space</p>
        </div>
        
        <div class="content">
          <div class="success-message">
            <h1>Welcome!</h1>
            <p>The smart lock has been successfully unlocked. You can now enter the space.</p>
          </div>

          <div class="timestamp">
            <div class="date">${getCurrentSingaporeDateTime().date}</div>
            <div class="time">${getCurrentSingaporeDateTime().time}</div>
          </div>

          <div class="details">
            <h3>🔧 Operation Details</h3>
            <div class="detail-row">
              <span class="detail-label">Device ID:</span>
              <span class="detail-value">Smart Lock Device</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Ticket ID:</span>
              <span class="detail-value">Generated Successfully</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Channel ID:</span>
              <span class="detail-value">Default Channel</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Access Start:</span>
              <span class="detail-value">${startTime ? formatSingaporeDateTime(new Date(startTime)) : 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Access End:</span>
              <span class="detail-value">${endTime ? formatSingaporeDateTime(new Date(endTime)) : 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value" style="color: #28a745; font-weight: 600;">✅ Success</span>
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #28a745; font-weight: 600; font-size: 16px;">
              🎉 Enjoy your time at My Productive Space!
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
          <p>This is an automated notification from our smart lock system.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML template for failed door opening
 * @param {string} error_message - Optional error message to display
 * @param {string} startTime - Booking start time
 * @param {string} endTime - Booking end time
 * @returns {string} HTML template
 */
const openDoorFailTemplate = (error_message = 'Unable to unlock the door. Please check your access permissions or try again.', startTime, endTime) => {
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Door Opening Failed</title>
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
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%); 
          color: white; 
          padding: 30px; 
          text-align: center; 
        }
        .error-icon {
          font-size: 48px;
          margin-bottom: 15px;
          animation: shake 0.5s ease-in-out infinite alternate;
        }
        @keyframes shake {
          0% { transform: translateX(-2px); }
          100% { transform: translateX(2px); }
        }
        .content { 
          padding: 30px; 
        }
        .error-message {
          text-align: center;
          margin-bottom: 30px;
        }
        .error-message h1 {
          color: #dc3545;
          margin-bottom: 10px;
          font-size: 28px;
        }
        .error-message p {
          color: #666;
          font-size: 16px;
        }
        .error-details {
          background: #fff5f5;
          border: 1px solid #fed7d7;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .error-details h3 {
          color: #c53030;
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 18px;
        }
        .error-text {
          background: #fed7d7;
          padding: 15px;
          border-radius: 8px;
          color: #c53030;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          word-break: break-all;
        }
        .details {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .details h3 {
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
        .footer { 
          text-align: center; 
          padding: 20px; 
          background: #f8f9fa;
          color: #6c757d; 
          font-size: 14px; 
        }
        .timestamp {
          background: #fff3cd;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          text-align: center;
        }
        .timestamp .date {
          font-size: 18px;
          font-weight: 600;
          color: #856404;
        }
        .timestamp .time {
          font-size: 14px;
          color: #666;
        }
        .help-section {
          background: #e3f2fd;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .help-section h3 {
          color: #1976d2;
          margin-top: 0;
        }
        .help-section ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .help-section li {
          margin-bottom: 5px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="error-icon">🔒</div>
          <h1>Door Opening Failed</h1>
          <p>Unable to unlock My Productive Space</p>
        </div>
        
        <div class="content">
          <div class="error-message">
            <h1>Sorry!</h1>
            <p>The smart lock could not be unlocked. Please try again or contact support.</p>
          </div>

          <div class="timestamp">
            <div class="date">${getCurrentSingaporeDateTime().date}</div>
            <div class="time">${getCurrentSingaporeDateTime().time}</div>
          </div>

          <div class="error-details">
            <h3>❌ Error Details</h3>
            <div class="error-text">${error_message}</div>
          </div>

          <div class="details">
            <h3>🔧 Operation Details</h3>
            <div class="detail-row">
              <span class="detail-label">Device ID:</span>
              <span class="detail-value">Smart Lock Device</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Ticket ID:</span>
              <span class="detail-value">Not Available</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Channel ID:</span>
              <span class="detail-value">Default Channel</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Access Start:</span>
              <span class="detail-value">${startTime ? formatSingaporeDateTime(new Date(startTime)) : 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Access End:</span>
              <span class="detail-value">${endTime ? formatSingaporeDateTime(new Date(endTime)) : 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value" style="color: #dc3545; font-weight: 600;">❌ Failed</span>
            </div>
          </div>

          <div class="help-section">
            <h3>🆘 Need Help?</h3>
            <ul>
              <li>Try unlocking the door again</li>
              <li>Check if your booking is still valid</li>
              <li>Ensure you have proper access permissions</li>
              <li>Contact support if the issue persists</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #dc3545; font-weight: 600; font-size: 16px;">
              Please try again or contact our support team.
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p>© 2025 My Productive Space. All rights reserved.</p>
          <p>This is an automated notification from our smart lock system.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  openDoorSuccessTemplate,
  openDoorFailTemplate
};
