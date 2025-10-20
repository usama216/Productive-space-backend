const cron = require('node-cron');
const { cleanupExpiredCredits } = require('./utils/creditHelper');

// Run credit cleanup daily at 2 AM
const startCreditCleanup = () => {
 
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Running daily credit cleanup...');
    
    try {
      const success = await cleanupExpiredCredits();
      
      if (success) {
        // console.log('✅ Credit cleanup completed successfully');
      } else {
        // console.error('❌ Credit cleanup failed');
      }
    } catch (error) {
      // console.error('❌ Error during credit cleanup:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Singapore"
  });
  
  // console.log('✅ Credit cleanup scheduler started - runs daily at 2 AM');
};

module.exports = { startCreditCleanup };
