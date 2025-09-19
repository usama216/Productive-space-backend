const supabase = require('./config/database');

async function testBookingExists() {
  try {
    const bookingId = '27e458b0-f0f6-4d95-be57-312b40e04250';
    
    console.log('🔍 Testing if booking exists...');
    console.log('Booking ID:', bookingId);
    
    // Test 1: Query with exact ID
    const { data: booking, error } = await supabase
      .from('"Booking"')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    console.log('Result:', { booking, error });
    
    // Test 2: Get all bookings to see what exists
    const { data: allBookings, error: allError } = await supabase
      .from('"Booking"')
      .select('id, bookingRef, userId, location, totalAmount')
      .limit(5);
    
    console.log('All bookings:', allBookings);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBookingExists();
