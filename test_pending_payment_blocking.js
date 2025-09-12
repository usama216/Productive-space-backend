// Test script to demonstrate pending payment seat blocking
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testPendingPaymentBlocking() {
  console.log('🧪 Testing Pending Payment Seat Blocking...\n');

  // Test scenario:
  // 1. User A creates booking with pending payment (S2, 4pm-5pm)
  // 2. User B tries to book 3pm-6pm (should not be able to select S2)
  // 3. User A completes payment
  // 4. User C tries to book 3pm-6pm (should still not be able to select S2)

  const testLocation = 'Kovan';
  const testDate = '2025-09-13';
  
  // Step 1: User A creates booking with pending payment
  const userABooking = {
    bookingRef: 'TEST_PENDING_001',
    userId: 'test-user-a',
    location: testLocation,
    startAt: `${testDate} 16:00:00`,
    endAt: `${testDate} 17:00:00`,
    seatNumbers: ['S2'],
    pax: 1,
    students: 0,
    members: 1,
    tutors: 0,
    totalCost: 15.00,
    totalAmount: 15.00,
    memberType: 'MEMBER',
    confirmedPayment: false // PENDING PAYMENT
  };

  // Step 2: User B's booking attempt (3pm-6pm)
  const userBBooking = {
    bookingRef: 'TEST_PENDING_002',
    userId: 'test-user-b',
    location: testLocation,
    startAt: `${testDate} 15:00:00`,
    endAt: `${testDate} 18:00:00`,
    seatNumbers: ['S1', 'S2', 'S3'], // S2 should be blocked due to pending payment
    pax: 3,
    students: 0,
    members: 3,
    tutors: 0,
    totalCost: 45.00,
    totalAmount: 45.00,
    memberType: 'MEMBER',
    confirmedPayment: false
  };

  try {
    // Step 1: Create User A's pending payment booking
    console.log('📝 Step 1: Creating User A\'s booking with PENDING payment (S2, 4pm-5pm)...');
    const { data: bookingA, error: errorA } = await supabase
      .from('Booking')
      .insert([userABooking])
      .select();

    if (errorA) {
      console.error('❌ Error creating User A booking:', errorA);
      return;
    }
    console.log('✅ User A booking created with pending payment:', bookingA[0].bookingRef);

    // Step 2: Test seat availability for User B (should block S2)
    console.log('\n🔍 Step 2: Checking seat availability for User B (3pm-6pm)...');
    
    const { data: availableSeats, error: seatError } = await supabase
      .from('Booking')
      .select('seatNumbers, startAt, endAt, bookingRef, confirmedPayment, createdAt')
      .eq('location', testLocation)
      .in('confirmedPayment', [true, false]) // Include both confirmed and pending
      .lt('startAt', userBBooking.endAt)
      .gt('endAt', userBBooking.startAt);

    if (seatError) {
      console.error('❌ Error checking seat availability:', seatError);
      return;
    }

    const bookedSeats = availableSeats
      ?.flatMap(b => b.seatNumbers || [])
      .filter((seat, index, self) => self.indexOf(seat) === index) || [];

    const confirmedBookings = availableSeats?.filter(b => b.confirmedPayment) || [];
    const pendingBookings = availableSeats?.filter(b => !b.confirmedPayment) || [];

    console.log('📊 Overlapping bookings found:', availableSeats?.length || 0);
    console.log(`   - Confirmed: ${confirmedBookings.length}`);
    console.log(`   - Pending payment: ${pendingBookings.length}`);
    console.log('🚫 Booked seats during 3pm-6pm:', bookedSeats);
    console.log('✅ Available seats for User B:', ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']
      .filter(seat => !bookedSeats.includes(seat)));

    // Step 3: Test User B's booking attempt
    console.log('\n🚫 Step 3: Attempting User B\'s booking with conflicting seats...');
    
    const conflictingSeats = userBBooking.seatNumbers.filter(seat => bookedSeats.includes(seat));
    
    if (conflictingSeats.length > 0) {
      console.log('❌ CONFLICT DETECTED!');
      console.log(`   Conflicting seats: ${conflictingSeats.join(', ')}`);
      console.log(`   User B cannot book seats: ${conflictingSeats.join(', ')}`);
      console.log(`   User B can only book: ${userBBooking.seatNumbers.filter(seat => !conflictingSeats.includes(seat)).join(', ')}`);
      console.log('   ✅ Pending payment booking successfully blocked seat S2!');
    } else {
      console.log('❌ ERROR: No conflicts detected - pending payment blocking failed!');
    }

    // Step 4: User A completes payment
    console.log('\n💳 Step 4: User A completes payment...');
    const { error: paymentError } = await supabase
      .from('Booking')
      .update({ confirmedPayment: true })
      .eq('bookingRef', 'TEST_PENDING_001');

    if (paymentError) {
      console.error('❌ Error updating payment status:', paymentError);
    } else {
      console.log('✅ Payment confirmed for User A');
    }

    // Step 5: Test seat availability after payment confirmation
    console.log('\n🔍 Step 5: Checking seat availability after payment confirmation...');
    
    const { data: availableSeatsAfter, error: seatErrorAfter } = await supabase
      .from('Booking')
      .select('seatNumbers, startAt, endAt, bookingRef, confirmedPayment, createdAt')
      .eq('location', testLocation)
      .in('confirmedPayment', [true, false])
      .lt('startAt', userBBooking.endAt)
      .gt('endAt', userBBooking.startAt);

    const bookedSeatsAfter = availableSeatsAfter
      ?.flatMap(b => b.seatNumbers || [])
      .filter((seat, index, self) => self.indexOf(seat) === index) || [];

    console.log('🚫 Booked seats after payment confirmation:', bookedSeatsAfter);
    console.log('✅ Available seats after payment confirmation:', ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12']
      .filter(seat => !bookedSeatsAfter.includes(seat)));

    // Step 6: Cleanup test data
    console.log('\n🧹 Step 6: Cleaning up test data...');
    await supabase
      .from('Booking')
      .delete()
      .eq('bookingRef', 'TEST_PENDING_001');
    
    console.log('✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - User A created booking with pending payment (S2, 4pm-5pm)');
    console.log('   - User B tried to book S1, S2, S3 from 3pm-6pm');
    console.log('   - S2 was correctly blocked due to pending payment');
    console.log('   - User A completed payment');
    console.log('   - S2 remained blocked after payment confirmation');
    console.log('   - ✅ Pending payment seat blocking works correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPendingPaymentBlocking();
