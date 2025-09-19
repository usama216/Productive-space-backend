const supabase = require('./config/database');
const { v4: uuidv4 } = require('uuid');

async function quickRefundTest() {
  try {
    console.log('🚀 Quick refund test...');
    
    const bookingId = uuidv4();
    const userId = 'b90c181e-874d-46c2-b1c8-3a510bbdef48';
    
    console.log('Creating booking:', bookingId);
    
    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('"Booking"')
      .insert([{
        id: bookingId,
        bookingRef: 'TEST_' + Date.now(),
        userId: userId,
        location: 'Test Location',
        bookedAt: new Date().toISOString(),
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
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
    
    if (bookingError) {
      console.error('❌ Error creating booking:', bookingError);
      return;
    }
    
    console.log('✅ Booking created:', booking.id);
    
    // Create refund transaction
    const { data: refund, error: refundError } = await supabase
      .from('refundtransactions')
      .insert({
        userid: userId,
        bookingid: bookingId,
        refundamount: 50.00,
        creditamount: 50.00,
        refundreason: 'Test refund',
        refundstatus: 'REQUESTED'
      })
      .select()
      .single();
    
    if (refundError) {
      console.error('❌ Error creating refund:', refundError);
    } else {
      console.log('✅ Refund created:', refund.id);
    }
    
    console.log('\n🎯 Test completed! Use this booking ID for refund test:');
    console.log(bookingId);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

quickRefundTest();
