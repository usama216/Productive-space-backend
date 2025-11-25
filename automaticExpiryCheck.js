require('dotenv').config();
const cron = require('node-cron');
const { convertExpiredStudents } = require('./utils/studentVerificationExpiry');

const IS_TESTING = false;
const CRON_SCHEDULE = IS_TESTING ? '*/5 * * * *' : '0 * * * *';

async function runExpiryCheck() {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Singapore',
    hour12: true 
  });
  try {
    const result = await convertExpiredStudents();
    
  } catch (error) {
    console.error(error.message);
  }
}

// Start cron job
const cronJob = cron.schedule(CRON_SCHEDULE, runExpiryCheck, {
  scheduled: true,
  timezone: "Asia/Singapore"
});


runExpiryCheck();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  cronJob.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  cronJob.stop();
  process.exit(0);
});

module.exports = { cronJob };

