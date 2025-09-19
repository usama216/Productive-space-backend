const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupRefundData() {
  console.log('🧹 Starting refund data cleanup...');
  
  try {
    // 1. Clear credit usage records
    console.log('1️⃣ Clearing credit usage records...');
    const { error: creditUsageError } = await supabase
      .from('creditusage')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (creditUsageError) {
      console.error('❌ Error clearing credit usage:', creditUsageError);
    } else {
      console.log('✅ Credit usage records cleared');
    }

    // 2. Clear user credits
    console.log('2️⃣ Clearing user credits...');
    const { error: userCreditsError } = await supabase
      .from('usercredits')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (userCreditsError) {
      console.error('❌ Error clearing user credits:', userCreditsError);
    } else {
      console.log('✅ User credits cleared');
    }

    // 3. Clear refund transactions
    console.log('3️⃣ Clearing refund transactions...');
    const { error: refundTransactionsError } = await supabase
      .from('refundtransactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (refundTransactionsError) {
      console.error('❌ Error clearing refund transactions:', refundTransactionsError);
    } else {
      console.log('✅ Refund transactions cleared');
    }

    // 4. Reset booking refund status
    console.log('4️⃣ Resetting booking refund status...');
    const { error: bookingResetError } = await supabase
      .from('Booking')
      .update({
        refundstatus: 'NONE',
        refundrequestedat: null,
        refundapprovedat: null,
        refundapprovedby: null,
        refundreason: null
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all records
    
    if (bookingResetError) {
      console.error('❌ Error resetting booking refund status:', bookingResetError);
    } else {
      console.log('✅ Booking refund status reset');
    }

    console.log('🎉 Refund data cleanup completed successfully!');
    console.log('📊 Summary:');
    console.log('   - Credit usage records: CLEARED');
    console.log('   - User credits: CLEARED');
    console.log('   - Refund transactions: CLEARED');
    console.log('   - Booking refund status: RESET TO NONE');
    
  } catch (error) {
    console.error('💥 Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupRefundData();
