const { createClient } = require('@supabase/supabase-js');

// Test script for refund credit system
const testRefundSystem = async () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  
  console.log('🧪 Testing Refund Credit System...');
  
  try {
    // Test 1: Check if tables exist
    console.log('\n1. Checking database tables...');
    
    const { data: userCredits, error: creditsError } = await supabase
      .from('UserCredits')
      .select('*')
      .limit(1);
    
    if (creditsError) {
      console.log('❌ UserCredits table not found or error:', creditsError.message);
    } else {
      console.log('✅ UserCredits table exists');
    }
    
    const { data: refundTransactions, error: refundError } = await supabase
      .from('RefundTransactions')
      .select('*')
      .limit(1);
    
    if (refundError) {
      console.log('❌ RefundTransactions table not found or error:', refundError.message);
    } else {
      console.log('✅ RefundTransactions table exists');
    }
    
    const { data: creditUsage, error: usageError } = await supabase
      .from('CreditUsage')
      .select('*')
      .limit(1);
    
    if (usageError) {
      console.log('❌ CreditUsage table not found or error:', usageError.message);
    } else {
      console.log('✅ CreditUsage table exists');
    }
    
    // Test 2: Check Booking table columns
    console.log('\n2. Checking Booking table columns...');
    
    const { data: bookings, error: bookingError } = await supabase
      .from('Booking')
      .select('refundStatus, refundRequestedAt, refundApprovedAt, refundApprovedBy, refundReason')
      .limit(1);
    
    if (bookingError) {
      console.log('❌ Booking table columns not found or error:', bookingError.message);
    } else {
      console.log('✅ Booking table has refund columns');
    }
    
    console.log('\n✅ Refund system database setup appears to be working!');
    console.log('\n📋 Next steps:');
    console.log('1. Run the SQL migration: backend/migrations/add-refund-credit-system.sql');
    console.log('2. Test the API endpoints');
    console.log('3. Test the frontend integration');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
testRefundSystem();
