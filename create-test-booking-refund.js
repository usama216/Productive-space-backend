const supabase = require('./config/database');
const { v4: uuidv4 } = require('uuid');

async function createTestBooking() {
  try {
    const bookingId = uuidv4();
    const userId = 'b90c181e-874d-46c2-b1c8-3a510bbdef48';
    
    console.log('🔍 Creating test booking...');
    console.log('Booking ID:', bookingId);
    console.log('User ID:', userId);
    
    const { data: booking, error } = await supabase
      .from('"Booking"')
      .insert([{
        id: bookingId,
        bookingRef: 'TEST_' + Date.now(),
        userId: userId,
        location: 'Test Location',
        bookedAt: new Date().toISOString(),
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
        specialRequests: null,
        seatNumbers: ['A1'],
        pax: 1,
        students: 0,
        members: 1,
        tutors: 0,
        totalCost: 50.00,
        discountId: null,
        totalAmount: 50.00,
        memberType: 'MEMBER',
        bookedForEmails: [],
        confirmedPayment: true,
        paymentId: uuidv4(),
        promocodeid: null,
        discountamount: 0,
        packageId: null,
        packageUsed: false,
        refundstatus: 'NONE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating booking:', error);
      return;
    }
    
    console.log('✅ Test booking created successfully:', booking);
    console.log('\n📋 Use this booking ID for refund test:');
    console.log(bookingId);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTestBooking();
