require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function createTestBooking() {
  try {
    console.log('🧪 Creating test unpaid booking...');
    
    const testBooking = {
      id: uuidv4(),
      bookingRef: `TEST${Date.now()}`,
      userId: 'b90c181e-874d-46c2-b1c8-3a510bbdef48', // Use a valid user ID
      location: 'Kovan',
      bookedAt: new Date().toISOString(),
      startAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
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
      confirmedPayment: false, // This is the key - unpaid booking
      paymentId: null,
      promocodeid: null,
      discountamount: 0,
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
    
    console.log('✅ Test booking created successfully!');
    console.log(`📋 Booking Ref: ${testBooking.bookingRef}`);
    console.log(`📋 Created at: ${testBooking.createdAt}`);
    console.log(`📋 Payment confirmed: ${testBooking.confirmedPayment}`);
    console.log('⏰ This booking should be cleaned up in 5 minutes by the cron job');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestBooking();
