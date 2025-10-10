// Force delete bookings by removing all foreign key references first
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function forceDeleteBookings() {
  try {
    console.log('🚀 Starting forceful deletion of unpaid bookings...');
    
    // Calculate cutoff time (5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Find unpaid bookings older than 5 minutes (exclude refunded bookings and extensions)
    const { data: unpaidBookings, error: fetchError } = await supabase
      .from('Booking')
      .select('id, bookingRef, createdAt, confirmedPayment, refundstatus, extensionamounts')
      .eq('confirmedPayment', false)
      .or('refundstatus.is.null,refundstatus.eq.NONE,refundstatus.eq.REQUESTED,refundstatus.eq.REJECTED')
      .or('extensionamounts.is.null,extensionamounts.eq.{}')
      .lt('createdAt', fiveMinutesAgo);
    
    if (fetchError) {
      console.error('❌ Error fetching unpaid bookings:', fetchError);
      return;
    }
    
    if (!unpaidBookings || unpaidBookings.length === 0) {
      console.log('✅ No unpaid bookings to clean up');
      return;
    }
    
    console.log(`📋 Found ${unpaidBookings.length} unpaid bookings to forcefully delete`);
    unpaidBookings.forEach(booking => {
      console.log(`  - ${booking.bookingRef} (ID: ${booking.id}, refund status: ${booking.refundstatus || 'NONE'})`);
    });
    
    const bookingIds = unpaidBookings.map(b => b.id);
    
    console.log('\n🗑️  Step 1: Deleting related creditusage records...');
    const { data: creditUsage, error: creditUsageError } = await supabase
      .from('creditusage')
      .delete()
      .in('bookingid', bookingIds);
    
    if (creditUsageError) {
      console.error('❌ Error deleting creditusage records:', creditUsageError);
    } else {
      console.log('✅ Successfully deleted creditusage records');
    }
    
    // Delete from other potential related tables
    console.log('\n🗑️  Step 2: Checking for other related records...');
    
    // Try to delete from packageusagehistory if it exists
    const { error: usageHistoryError } = await supabase
      .from('packageusagehistory')
      .delete()
      .in('bookingid', bookingIds);
    
    if (usageHistoryError && usageHistoryError.code !== '42P01') { // 42P01 = table doesn't exist
      console.error('⚠️  Error deleting packageusagehistory records:', usageHistoryError);
    } else if (!usageHistoryError) {
      console.log('✅ Successfully deleted packageusagehistory records');
    }
    
    // Try to delete from reschedulehistory if it exists
    const { error: rescheduleError } = await supabase
      .from('reschedulehistory')
      .delete()
      .in('bookingid', bookingIds);
    
    if (rescheduleError && rescheduleError.code !== '42P01') {
      console.error('⚠️  Error deleting reschedulehistory records:', rescheduleError);
    } else if (!rescheduleError) {
      console.log('✅ Successfully deleted reschedulehistory records');
    }
    
    // Try to delete from refund table if it exists
    const { error: refundError } = await supabase
      .from('refund')
      .delete()
      .in('bookingid', bookingIds);
    
    if (refundError && refundError.code !== '42P01') {
      console.error('⚠️  Error deleting refund records:', refundError);
    } else if (!refundError) {
      console.log('✅ Successfully deleted refund records');
    }
    
    console.log('\n🗑️  Step 3: Deleting bookings...');
    const { error: deleteError } = await supabase
      .from('Booking')
      .delete()
      .in('id', bookingIds);
    
    if (deleteError) {
      console.error('❌ Error deleting bookings:', deleteError);
      console.log('\n💡 Tip: There might be other tables referencing these bookings.');
      console.log('   Error details:', JSON.stringify(deleteError, null, 2));
      return;
    }
    
    console.log(`\n✅ Successfully force-deleted ${unpaidBookings.length} bookings!`);
    unpaidBookings.forEach(booking => {
      console.log(`  ✓ Deleted ${booking.bookingRef}`);
    });
    
  } catch (error) {
    console.error('❌ Force delete error:', error);
  }
}

// Run the force delete
forceDeleteBookings()
  .then(() => {
    console.log('\n🏁 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

module.exports = { forceDeleteBookings };
