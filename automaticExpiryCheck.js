// Automatic Student Verification Expiry Check
// Runs automatically in background when backend starts
// Checks every 5 minutes (testing) or 1 hour (production)

require('dotenv').config();
const cron = require('node-cron');
const { convertExpiredStudents } = require('./utils/studentVerificationExpiry');

// Configuration
const IS_TESTING = false; // Set to true for testing (5 min), false for production (1 hour)

// Schedule:
// Testing: Every 5 minutes → '*/5 * * * *'
// Production: Every 1 hour → '0 * * * *'
const CRON_SCHEDULE = IS_TESTING ? '*/5 * * * *' : '0 * * * *';

console.log('🤖 Automatic Expiry Check System Starting...');
console.log(`📅 Mode: ${IS_TESTING ? 'TESTING (Every 5 minutes)' : 'PRODUCTION (Every 1 hour)'}`);
console.log(`⏰ Schedule: ${CRON_SCHEDULE}`);
console.log(`🌏 Timezone: GMT+8 (Asia/Singapore)`);

async function runExpiryCheck() {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Singapore',
    hour12: true 
  });
  
  console.log('\n========================================');
  console.log('🕒 Auto Expiry Check Started');
  console.log('Time:', timestamp);
  console.log('========================================');

  try {
    const result = await convertExpiredStudents();
    
    console.log('📊 Summary:');
    console.log('  Total Checked:', result.totalChecked || 0);
    console.log('  Expired Found:', result.expired || 0);
    console.log('  Converted:', result.converted || 0);
    console.log('  Errors:', result.errors?.length || 0);
    
    if (result.converted > 0) {
      console.log('✅ Successfully converted', result.converted, 'student(s) to members');
    } else {
      console.log('✅ No expired verifications found');
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('⚠️ Errors:', result.errors.length);
    }
    
  } catch (error) {
    console.error('❌ Error in auto expiry check:', error.message);
  }
  
  console.log('========================================\n');
}

// Start cron job
const cronJob = cron.schedule(CRON_SCHEDULE, runExpiryCheck, {
  scheduled: true,
  timezone: "Asia/Singapore"
});

console.log('✅ Automatic Expiry Check Cron Job Started!');
console.log(`⏰ Next run: ${IS_TESTING ? '5 minutes' : '1 hour'} from now\n`);

// Run once immediately on startup (optional - can comment out if not needed)
console.log('🚀 Running initial check on startup...');
runExpiryCheck();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, stopping cron job...');
  cronJob.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT received, stopping cron job...');
  cronJob.stop();
  process.exit(0);
});

module.exports = { cronJob };

