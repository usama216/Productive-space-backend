require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testTiming() {
  try {
    console.log('🧪 Testing booking cleanup timing...');
    
    // Create a test unpaid booking
    const testBooking = {
      id: uuidv4(),
      bookingRef: `TIMING${Date.now()}`,
      userId: 'b90c181e-874d-46c2-b1c8-3a510bbdef48',
      location: 'Kovan',
      bookedAt: new Date().toISOString(),
      startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      specialRequests: null,
      seatNumbers: ['S1'],
      pax: 1,
      students: 0,
      members: 1,
      tutors: 0,
      totalCost: 100,
      discountId: null,
      totalAmount: 100,
      memberType: 'MEMBER',
      bookedForEmails: ['test@example.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      confirmedPayment: false,
      paymentId: null,
      promocodeId: null,
      discountAmount: 0,
      packageId: null,
      packageUsed: false
    };
    
    const { data, error } = await supabase
      .from('Booking')
      .insert([testBooking])
      .select('*');
    
    if (error) {
      console.error('❌ Error creating test booking:', error);
      return;
    }
    
    const createdTime = new Date(testBooking.createdAt);
    console.log('✅ Test booking created successfully!');
    console.log(`📋 Booking Ref: ${testBooking.bookingRef}`);
    console.log(`📋 Created at: ${createdTime.toLocaleTimeString()}`);
    console.log(`📋 Payment confirmed: ${testBooking.confirmedPayment}`);
    console.log('');
    console.log('⏰ TIMING EXPLANATION:');
    console.log('   - Old cron: Runs at 1:05, 1:10, 1:15, 1:20...');
    console.log('   - New cron: Runs at 1:01, 1:02, 1:03, 1:04, 1:05...');
    console.log('');
    console.log('📅 EXPECTED CLEANUP:');
    console.log(`   - Booking will be deleted at: ${new Date(createdTime.getTime() + 5 * 60 * 1000).toLocaleTimeString()}`);
    console.log('   - (5 minutes after creation)');
    console.log('');
    console.log('🔄 The cron job now runs every minute, so cleanup will happen within 1 minute of the 5-minute mark');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testTiming();
