// Cleanup job to remove unpaid bookings after 10 minutes
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function cleanupUnpaidBookings() {
  try {
    console.log('Starting cleanup of unpaid bookings...');
    
    // Calculate cutoff time (10 minutes ago)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    // Find unpaid bookings older than 10 minutes
    const { data: unpaidBookings, error: fetchError } = await supabase
      .from('Booking')
      .select('id, bookingRef, createdAt, confirmedPayment')
      .eq('confirmedPayment', false)
      .lt('createdAt', tenMinutesAgo);
    
    if (fetchError) {
      console.error('Error fetching unpaid bookings:', fetchError);
      return;
    }
    
    if (!unpaidBookings || unpaidBookings.length === 0) {
      console.log('No unpaid bookings to clean up');
      return;
    }
    
    console.log(`📋 Found ${unpaidBookings.length} unpaid bookings to clean up`);
    
    // Delete the unpaid bookings
    const { error: deleteError } = await supabase
      .from('Booking')
      .delete()
      .eq('confirmedPayment', false)
      .lt('createdAt', tenMinutesAgo);
    
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
