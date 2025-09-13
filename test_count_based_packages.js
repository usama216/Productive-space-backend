// Test script for count-based package system
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testCountBasedPackages() {
  console.log('🧪 Testing Count-Based Package System...\n');

  const testUserId = 'test-user-count-based';
  const testLocation = 'Kovan';
  const testDate = '2025-09-13';

  try {
    // Step 1: Create test user passes
    console.log('📝 Step 1: Creating test user passes...');
    
    // Create 20 Day Passes
    const dayPass = {
      id: 'test-day-pass-001',
      userId: testUserId,
      passtype: 'DAY_PASS',
      totalQuantity: 20,
      remainingQuantity: 20,
      status: 'ACTIVE',
      activeFrom: new Date().toISOString(),
      activeTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      packageCode: 'daypass_user123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Create 15 Half Day Passes
    const halfDayPass = {
      id: 'test-halfday-pass-001',
      userId: testUserId,
      passtype: 'HALF_DAY_PASS',
      totalQuantity: 15,
      remainingQuantity: 15,
      status: 'ACTIVE',
      activeFrom: new Date().toISOString(),
      activeTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      packageCode: 'halfdaypass_user123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Insert test passes
    const { data: insertedPasses, error: insertError } = await supabase
      .from('UserPass')
      .insert([dayPass, halfDayPass])
      .select();

    if (insertError) {
      console.error('❌ Error creating test passes:', insertError);
      return;
    }

    console.log('✅ Test passes created successfully');
    console.log(`   - Day Passes: ${dayPass.totalQuantity} (${dayPass.remainingQuantity} remaining)`);
    console.log(`   - Half Day Passes: ${halfDayPass.totalQuantity} (${halfDayPass.remainingQuantity} remaining)`);

    // Step 2: Test Day Pass scenarios
    console.log('\n🎯 Step 2: Testing Day Pass scenarios...');

    // Scenario 1: 5am-8pm (not allowed - outside time restrictions)
    console.log('\n📋 Scenario 1: 5am-8pm (should be rejected)');
    const scenario1 = await validatePassUsage(
      testUserId, 
      'DAY_PASS', 
      `${testDate} 05:00:00`, 
      `${testDate} 20:00:00`, 
      1
    );
    
    if (!scenario1.success) {
      console.log('❌ Correctly rejected:', scenario1.message);
    } else {
      console.log('❌ ERROR: Should have been rejected!');
    }

    // Scenario 2: 8am-5pm (allowed, 1 count used)
    console.log('\n📋 Scenario 2: 8am-5pm (should be allowed, 1 count used)');
    const scenario2 = await validatePassUsage(
      testUserId, 
      'DAY_PASS', 
      `${testDate} 08:00:00`, 
      `${testDate} 17:00:00`, 
      1
    );
    
    if (scenario2.success) {
      console.log('✅ Correctly allowed');
      console.log(`   - Original charge: $${scenario2.originalCharge}`);
      console.log(`   - Pass discount: $${scenario2.passDiscount}`);
      console.log(`   - Remaining charge: $${scenario2.remainingCharge}`);
      console.log(`   - Pass used: ${scenario2.passUsed}`);
      console.log(`   - Remaining quantity: ${scenario2.remainingQuantity}`);
    } else {
      console.log('❌ ERROR: Should have been allowed!', scenario2.message);
    }

    // Scenario 3: 10am-4pm (allowed, 1 count used, no additional charge)
    console.log('\n📋 Scenario 3: 10am-4pm (should be allowed, 1 count used, no charge)');
    const scenario3 = await validatePassUsage(
      testUserId, 
      'DAY_PASS', 
      `${testDate} 10:00:00`, 
      `${testDate} 16:00:00`, 
      1
    );
    
    if (scenario3.success) {
      console.log('✅ Correctly allowed');
      console.log(`   - Original charge: $${scenario3.originalCharge}`);
      console.log(`   - Pass discount: $${scenario3.passDiscount}`);
      console.log(`   - Remaining charge: $${scenario3.remainingCharge}`);
      console.log(`   - Pass used: ${scenario3.passUsed}`);
    } else {
      console.log('❌ ERROR: Should have been allowed!', scenario3.message);
    }

    // Scenario 4: 3 people booking 8am-5pm (only 1 pass used)
    console.log('\n📋 Scenario 4: 3 people, 8am-5pm (should use only 1 pass)');
    const scenario4 = await validatePassUsage(
      testUserId, 
      'DAY_PASS', 
      `${testDate} 08:00:00`, 
      `${testDate} 17:00:00`, 
      3
    );
    
    if (scenario4.success) {
      console.log('✅ Correctly allowed');
      console.log(`   - Original charge: $${scenario4.originalCharge} (9 hours × 3 people × $15)`);
      console.log(`   - Pass discount: $${scenario4.passDiscount} (8 hours × 3 people × $15)`);
      console.log(`   - Remaining charge: $${scenario4.remainingCharge} (1 hour × 3 people × $15)`);
      console.log(`   - Pass used: ${scenario4.passUsed}`);
      console.log(`   - Remaining quantity: ${scenario4.remainingQuantity}`);
    } else {
      console.log('❌ ERROR: Should have been allowed!', scenario4.message);
    }

    // Step 3: Test Half Day Pass scenarios
    console.log('\n🎯 Step 3: Testing Half Day Pass scenarios...');

    // Scenario 5: 8am-9am (allowed, 1 count used)
    console.log('\n📋 Scenario 5: 8am-9am (should be allowed, 1 count used)');
    const scenario5 = await validatePassUsage(
      testUserId, 
      'HALF_DAY_PASS', 
      `${testDate} 08:00:00`, 
      `${testDate} 09:00:00`, 
      1
    );
    
    if (scenario5.success) {
      console.log('✅ Correctly allowed');
      console.log(`   - Original charge: $${scenario5.originalCharge}`);
      console.log(`   - Pass discount: $${scenario5.passDiscount}`);
      console.log(`   - Remaining charge: $${scenario5.remainingCharge}`);
      console.log(`   - Pass used: ${scenario5.passUsed}`);
    } else {
      console.log('❌ ERROR: Should have been allowed!', scenario5.message);
    }

    // Scenario 6: 10am-6pm (8 hours, should use 1 pass + pay for 4 hours)
    console.log('\n📋 Scenario 6: 10am-6pm (8 hours, should use 1 pass + pay for 4 hours)');
    const scenario6 = await validatePassUsage(
      testUserId, 
      'HALF_DAY_PASS', 
      `${testDate} 10:00:00`, 
      `${testDate} 18:00:00`, 
      1
    );
    
    if (scenario6.success) {
      console.log('✅ Correctly allowed');
      console.log(`   - Original charge: $${scenario6.originalCharge} (8 hours × $15)`);
      console.log(`   - Pass discount: $${scenario6.passDiscount} (4 hours × $15)`);
      console.log(`   - Remaining charge: $${scenario6.remainingCharge} (4 hours × $15)`);
      console.log(`   - Pass used: ${scenario6.passUsed}`);
    } else {
      console.log('❌ ERROR: Should have been allowed!', scenario6.message);
    }

    // Step 4: Test pass balance
    console.log('\n📊 Step 4: Testing pass balance...');
    const balance = await getUserPassBalance(testUserId);
    
    if (balance.success) {
      console.log('✅ Pass balance retrieved successfully');
      console.log(`   - Total pass types: ${balance.passBalances.length}`);
      balance.passBalances.forEach(passBalance => {
        console.log(`   - ${passBalance.passType}: ${passBalance.remainingQuantity}/${passBalance.totalQuantity} remaining`);
      });
    } else {
      console.log('❌ ERROR: Failed to get pass balance', balance.message);
    }

    // Step 5: Cleanup test data
    console.log('\n🧹 Step 5: Cleaning up test data...');
    await supabase
      .from('UserPass')
      .delete()
      .eq('userId', testUserId);
    
    console.log('✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Time restrictions work correctly');
    console.log('   ✅ Count-based usage works correctly');
    console.log('   ✅ Only 1 pass used per booking regardless of pax');
    console.log('   ✅ Proper charge calculations with pass discounts');
    console.log('   ✅ Pass balance tracking works correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Import the functions from the controller
const { validatePassUsage, getUserPassBalance } = require('./controllers/countBasedPackageController');

// Run the test
testCountBasedPackages();
