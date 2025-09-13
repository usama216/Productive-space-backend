// Scheduled cleanup job that runs every minute
require('dotenv').config();
const cron = require('node-cron');
const { cleanupUnpaidBookings } = require('./cleanupUnpaidBookings');

// Run cleanup every 10 minutes
cron.schedule('*/10 * * * *', () => {
  console.log('⏰ Running scheduled cleanup...');
  cleanupUnpaidBookings();
});

console.log('🕐 Scheduled cleanup job started - running every 10 minutes');

// Export for use in app.js
module.exports = { cleanupUnpaidBookings };
