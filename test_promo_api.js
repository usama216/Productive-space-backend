// Test script for Promo Code APIs
// Run this to test your endpoints

const BASE_URL = 'http://localhost:3000'; // Change this to your server URL

// Test 1: Check if PromoCode table exists and has data
async function testPromoCodeTable() {
  console.log('🧪 Testing PromoCode table connection...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/promocode/test`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Table test successful:', data);
    } else {
      console.log('❌ Table test failed:', data);
    }
  } catch (error) {
    console.log('❌ Table test error:', error.message);
  }
}

// Test 2: Get all promo codes (public endpoint)
async function testGetAllPromoCodes() {
  console.log('\n🧪 Testing get all promo codes (public endpoint)...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/promocode/public/all`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Get all promo codes successful:', {
        count: data.promoCodes?.length || 0,
        pagination: data.pagination
      });
      
      if (data.promoCodes && data.promoCodes.length > 0) {
        console.log('📋 Sample promo codes:');
        data.promoCodes.slice(0, 3).forEach((promo, index) => {
          console.log(`  ${index + 1}. ${promo.code} - ${promo.description}`);
        });
      }
    } else {
      console.log('❌ Get all promo codes failed:', data);
    }
  } catch (error) {
    console.log('❌ Get all promo codes error:', error.message);
  }
}

// Test 3: Get all promo codes (admin endpoint)
async function testGetAllPromoCodesAdmin() {
  console.log('\n🧪 Testing get all promo codes (admin endpoint)...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/promocode/admin/all`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Admin endpoint successful:', {
        count: data.promoCodes?.length || 0,
        pagination: data.pagination
      });
    } else {
      console.log('❌ Admin endpoint failed:', data);
    }
  } catch (error) {
    console.log('❌ Admin endpoint error:', error.message);
  }
}

// Test 4: Apply a promo code
async function testApplyPromoCode() {
  console.log('\n🧪 Testing apply promo code...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/promocode/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promoCode: 'WELCOME20',
        userId: 'test-user-123',
        bookingAmount: 100.00
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Apply promo code successful:', data);
    } else {
      console.log('❌ Apply promo code failed:', data);
    }
  } catch (error) {
    console.log('❌ Apply promo code error:', error.message);
  }
}

// Test 5: Get available promo codes for user
async function testGetAvailablePromos() {
  console.log('\n🧪 Testing get available promo codes...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/promocode/user/test-user-123/available`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Get available promos successful:', {
        count: data.availablePromos?.length || 0
      });
    } else {
      console.log('❌ Get available promos failed:', data);
    }
  } catch (error) {
    console.log('❌ Get available promos error:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Promo Code API Tests...\n');
  
  await testPromoCodeTable();
  await testGetAllPromoCodes();
  await testGetAllPromoCodesAdmin();
  await testApplyPromoCode();
  await testGetAvailablePromos();
  
  console.log('\n✨ All tests completed!');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  const fetch = require('node-fetch');
  runAllTests();
} else {
  // Browser environment
  runAllTests();
}

// Export for use in other files
module.exports = {
  testPromoCodeTable,
  testGetAllPromoCodes,
  testGetAllPromoCodesAdmin,
  testApplyPromoCode,
  testGetAvailablePromos,
  runAllTests
};
