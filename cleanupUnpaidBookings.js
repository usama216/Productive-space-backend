// Cleanup job to remove unpaid bookings after 5 minutes
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function cleanupUnpaidBookings() {
  try {
    
    
    // Calculate cutoff time (5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Find unpaid bookings older than 5 minutes (exclude refunded bookings and extensions)
    const { data: unpaidBookings, error: fetchError } = await supabase
      .from('Booking')
      .select('id, bookingRef, createdAt, confirmedPayment, refundstatus, extensionamounts')
      .eq('confirmedPayment', false)
      .or('refundstatus.is.null,refundstatus.eq.NONE,refundstatus.eq.REQUESTED,refundstatus.eq.REJECTED') // Only include non-refunded bookings
      .or('extensionamounts.is.null,extensionamounts.eq.{}') // Exclude bookings with extensions
      .lt('createdAt', fiveMinutesAgo);
    
    if (fetchError) {
      console.error('Error fetching unpaid bookings:', fetchError);
      return;
    }
    
    if (!unpaidBookings || unpaidBookings.length === 0) {
      console.log('No unpaid bookings to clean up');
      return;
    }
    
    console.log(`📋 Found ${unpaidBookings.length} unpaid bookings to clean up`);
    
    // Log which bookings will be cleaned up
    unpaidBookings.forEach(booking => {
      console.log(`  - ${booking.bookingRef} (refund status: ${booking.refundstatus || 'NONE'})`);
    });
    
    const bookingIds = unpaidBookings.map(b => b.id);
    
    // Step 1: Delete related creditusage records first (to avoid foreign key constraint)
    console.log('🗑️  Deleting related creditusage records...');
    const { error: creditUsageError } = await supabase
      .from('creditusage')
      .delete()
      .in('bookingid', bookingIds);
    
    if (creditUsageError) {
      console.error('⚠️  Error deleting creditusage records:', creditUsageError);
    }
    
    // Step 2: Delete the unpaid bookings
    const { error: deleteError } = await supabase
      .from('Booking')
      .delete()
      .in('id', bookingIds);
    
    if (deleteError) {
      console.error('❌ Error deleting unpaid bookings:', deleteError);
      return;
    }
    
    console.log(`✅ Successfully cleaned up ${unpaidBookings.length} unpaid bookings`);
    
    // Log the cleaned up bookings for reference
    unpaidBookings.forEach(booking => {
      console.log(`  - Deleted booking ${booking.bookingRef} (created: ${booking.createdAt})`);
    });
    
  } catch (error) {
    console.error('❌ Cleanup job error:', error);
  }
}

// Run cleanup immediately
cleanupUnpaidBookings();

// Export for use in other files
module.exports = { cleanupUnpaidBookings };
