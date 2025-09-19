const supabase = require('./config/database');

async function testSimple() {
  try {
    console.log('🔍 Testing simple booking query...');
    console.log('Supabase URL:', process.env.SUPABASE_URL ? 'Set' : 'Not set');
    console.log('Supabase Key:', process.env.SUPABASE_KEY ? 'Set' : 'Not set');
    
    // Test 1: Get all bookings
    console.log('\n📊 Test 1: Getting all bookings...');
    const { data: allBookings, error: allError } = await supabase
      .from('"Booking"')
      .select('id, bookingRef, userId, totalAmount, confirmedPayment')
      .limit(5);
    
    console.log('All bookings result:', { allBookings, allError });
    
    // Test 2: Get specific booking
    console.log('\n📊 Test 2: Getting specific booking...');
    const bookingId = '0ab7e2ad-47e3-4e91-91ec-7dd2cdcd71ab';
    const { data: specificBooking, error: specificError } = await supabase
      .from('"Booking"')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    console.log('Specific booking result:', { specificBooking, specificError });
    
    // Test 3: Try with lowercase table name
    console.log('\n📊 Test 3: Trying with lowercase table name...');
    const { data: booking3, error: error3 } = await supabase
      .from('booking')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    console.log('Lowercase table result:', { booking3, error3 });
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  }
}

testSimple().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
