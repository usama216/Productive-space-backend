// Scheduled Student Verification Expiry Check
// This script checks for expired student verifications and auto-converts them to members
// Should be run daily via cron job or scheduled task

// Load environment variables
require('dotenv').config();

const { convertExpiredStudents } = require('./utils/studentVerificationExpiry');

async function runExpiryCheck() {
  console.log('========================================');
  console.log('🕒 Student Verification Expiry Check Started');
  console.log('Time:', new Date().toISOString());
  console.log('========================================');

  try {
    console.log('🔍 Calling convertExpiredStudents function...');
    const result = await convertExpiredStudents();
    console.log('✅ Function returned:', JSON.stringify(result, null, 2));
    
    console.log('\n========================================');
    console.log('📊 Expiry Check Summary:');
    console.log('Total Checked:', result.totalChecked || 0);
    console.log('Expired Found:', result.expired || 0);
    console.log('Successfully Converted:', result.converted || 0);
    console.log('Errors:', result.errors?.length || 0);
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      result.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. User: ${err.email || err.userId}`);
        console.log(`     Error: ${err.error}`);
      });
    }
    
    console.log('========================================');
    console.log('✅ Student Verification Expiry Check Completed');
    console.log('Time:', new Date().toISOString());
    console.log('========================================\n');

  } catch (error) {
    console.error('========================================');
    console.error('❌ Fatal Error in Expiry Check:');
    console.error(error);
    console.error('Stack trace:', error.stack);
    console.error('========================================\n');
    
    // Don't exit with error in production - just log it
    // This prevents cron job from stopping
    console.log('⚠️ Continuing despite error...');
    process.exit(0); // Exit normally to not break cron
  }
}

// If this file is run directly (not imported as module)
if (require.main === module) {
  runExpiryCheck()
    .then(() => {
      console.log('Script execution completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runExpiryCheck };

