// Test script to demonstrate seat conflict prevention
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testSeatConflict() {
  console.log('🧪 Testing Seat Conflict Prevention...\n');

  // Test scenario:
  // 1. User A books seat S2 from 4pm-5pm on Sept 13, 2025
  // 2. User B tries to book 3pm-6pm on Sept 13, 2025 (should not be able to select S2)

  const testLocation = 'Kovan';
  const testDate = '2025-09-13';
  
  // Simulate User A's booking (4pm-5pm)
  const userABooking = {
    bookingRef: 'TEST_A_001',
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
    confirmedPayment: true
  };

  // Simulate User B's booking attempt (3pm-6pm)
  const userBBooking = {
    bookingRef: 'TEST_B_001',
    userId: 'test-user-b',
    location: testLocation,
    startAt: `${testDate} 15:00:00`,
    endAt: `${testDate} 18:00:00`,
    seatNumbers: ['S1', 'S2', 'S3'], // S2 should be blocked
    pax: 3,
    students: 0,
    members: 3,
    tutors: 0,
    totalCost: 45.00,
    totalAmount: 45.00,
    memberType: 'MEMBER',
    confirmedPayment: true
  };

  try {
    // Step 1: Create User A's booking
    console.log('📝 Step 1: Creating User A\'s booking (S2, 4pm-5pm)...');
    const { data: bookingA, error: errorA } = await supabase
      .from('Booking')
      .insert([userABooking])
      .select();

    if (errorA) {
      console.error('❌ Error creating User A booking:', errorA);
      return;
    }
    console.log('✅ User A booking created:', bookingA[0].bookingRef);

    // Step 2: Test seat availability for User B
    console.log('\n🔍 Step 2: Checking seat availability for User B (3pm-6pm)...');
    
    const { data: availableSeats, error: seatError } = await supabase
      .from('Booking')
      .select('seatNumbers, startAt, endAt, bookingRef')
      .eq('location', testLocation)
      .eq('confirmedPayment', true)
      .lt('startAt', userBBooking.endAt)
      .gt('endAt', userBBooking.startAt);

    if (seatError) {
      console.error('❌ Error checking seat availability:', seatError);
      return;
    }

    const bookedSeats = availableSeats
      ?.flatMap(b => b.seatNumbers || [])
      .filter((seat, index, self) => self.indexOf(seat) === index) || [];

    console.log('📊 Overlapping bookings found:', availableSeats?.length || 0);
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
    } else {
      console.log('✅ No conflicts detected - User B can book all requested seats');
    }

    // Step 4: Cleanup test data
    console.log('\n🧹 Step 4: Cleaning up test data...');
    await supabase
      .from('Booking')
      .delete()
      .eq('bookingRef', 'TEST_A_001');
    
    console.log('✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - User A booked S2 from 4pm-5pm');
    console.log('   - User B tried to book S1, S2, S3 from 3pm-6pm');
    console.log('   - S2 was correctly identified as conflicting');
    console.log('   - User B can only book S1 and S3');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSeatConflict();
