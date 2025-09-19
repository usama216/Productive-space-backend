const supabase = require('./config/database');

async function testBooking() {
  try {
    const bookingId = '0ab7e2ad-47e3-4e91-91ec-7dd2cdcd71ab';
    const userId = 'b90c181e-874d-46c2-b1c8-3a510bbdef48';
    
    console.log('🔍 Testing booking query...');
    console.log('Booking ID:', bookingId);
    console.log('User ID:', userId);
    
    // Test 1: Query with "Booking" table
    console.log('\n📊 Test 1: Querying "Booking" table...');
    const { data: booking1, error: error1 } = await supabase
      .from('"Booking"')
      .select('*')
      .eq('id', bookingId)
      .eq('userId', userId)
      .single();
    
    console.log('Result 1:', { booking1, error1 });
    
    // Test 2: Query with booking table (lowercase)
    console.log('\n📊 Test 2: Querying booking table (lowercase)...');
    const { data: booking2, error: error2 } = await supabase
      .from('booking')
      .select('*')
      .eq('id', bookingId)
      .eq('userid', userId)
      .single();
    
    console.log('Result 2:', { booking2, error2 });
    
    // Test 3: Query without user filter
    console.log('\n📊 Test 3: Querying without user filter...');
    const { data: booking3, error: error3 } = await supabase
      .from('"Booking"')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    console.log('Result 3:', { booking3, error3 });
    
    // Test 4: List all tables
    console.log('\n📊 Test 4: Listing all tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    console.log('Tables:', tables?.map(t => t.table_name));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBooking();
