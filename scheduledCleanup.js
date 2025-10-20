// Scheduled cleanup job that runs every 3 minutes
require('dotenv').config();
const cron = require('node-cron');
const { cleanupUnpaidBookings } = require('./cleanupUnpaidBookings');

// Run cleanup every 3 minutes
cron.schedule('*/3 * * * *', () => {
  console.log('⏰ Running scheduled cleanup...');
  cleanupUnpaidBookings();
});



// Export for use in app.js
module.exports = { cleanupUnpaidBookings };
