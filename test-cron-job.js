require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testCronJob() {
  try {
    console.log('🧪 Testing cron job functionality...');
    
    // Check current unpaid bookings
    const { data: unpaidBookings, error: fetchError } = await supabase
      .from('Booking')
      .select('id, bookingRef, createdAt, confirmedPayment')
      .eq('confirmedPayment', false)
      .order('createdAt', { ascending: false });
    
    if (fetchError) {
      console.error('❌ Error fetching unpaid bookings:', fetchError);
      return;
    }
    
    console.log(`📋 Found ${unpaidBookings?.length || 0} unpaid bookings`);
    
    if (unpaidBookings && unpaidBookings.length > 0) {
      console.log('📋 Unpaid bookings:');
      unpaidBookings.forEach((booking, index) => {
        const createdAt = new Date(booking.createdAt);
        const now = new Date();
        const minutesAgo = Math.floor((now - createdAt) / (1000 * 60));
        console.log(`  ${index + 1}. ${booking.bookingRef} - Created ${minutesAgo} minutes ago`);
      });
      
      // Check which ones should be cleaned up (older than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const shouldBeCleaned = unpaidBookings.filter(booking => 
        new Date(booking.createdAt) < fiveMinutesAgo
      );
      
      console.log(`\n🧹 ${shouldBeCleaned.length} bookings should be cleaned up (older than 5 minutes)`);
      
      if (shouldBeCleaned.length > 0) {
        console.log('🧹 Bookings that should be cleaned:');
        shouldBeCleaned.forEach((booking, index) => {
          const createdAt = new Date(booking.createdAt);
          const minutesAgo = Math.floor((now - createdAt) / (1000 * 60));
          console.log(`  ${index + 1}. ${booking.bookingRef} - Created ${minutesAgo} minutes ago`);
        });
      }
    } else {
      console.log('✅ No unpaid bookings found');
    }
    
    // Test the cleanup function
    console.log('\n🧪 Testing cleanup function...');
    const { cleanupUnpaidBookings } = require('./cleanupUnpaidBookings');
    await cleanupUnpaidBookings();
    
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testCronJob();
