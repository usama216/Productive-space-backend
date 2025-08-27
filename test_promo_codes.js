// Test Promo Code APIs
// Use these examples to test your promo code system

// ==================== SETUP ====================
// Replace these values with your actual data
const BASE_URL = "http://localhost:8000/api/promocode"; // or your actual domain
const USER_ID = "your-user-uuid-here";
const ADMIN_TOKEN = "your-admin-token-here"; // if you implement admin auth

// ==================== USER/CLIENT API TESTS ====================

// 1. Apply Promo Code
console.log("=== Testing Apply Promo Code ===");
console.log(`POST ${BASE_URL}/apply`);
console.log("Body:");
console.log(JSON.stringify({
  promoCode: "WELCOME20",
  userId: USER_ID,
  bookingAmount: 100.00
}, null, 2));

// 2. Get User's Available Promo Codes
console.log("\n=== Testing Get Available Promo Codes ===");
console.log(`GET ${BASE_URL}/user/${USER_ID}/available`);

// 3. Get User's Used Promo Codes
console.log("\n=== Testing Get Used Promo Codes ===");
console.log(`GET ${BASE_URL}/user/${USER_ID}/used`);

// ==================== ADMIN API TESTS ====================

// 4. Create Promo Code
console.log("\n=== Testing Create Promo Code ===");
console.log(`POST ${BASE_URL}/admin/create`);
console.log("Body:");
console.log(JSON.stringify({
  code: "TEST25",
  description: "Test promo code for testing",
  discountType: "percentage",
  discountValue: 25,
  maxDiscountAmount: 50.00,
  minimumAmount: 20.00,
  validFrom: new Date().toISOString(),
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
  usageLimit: 5,
  globalUsageLimit: 100,
  isActive: true
}, null, 2));

// 5. Get All Promo Codes
console.log("\n=== Testing Get All Promo Codes ===");
console.log(`GET ${BASE_URL}/admin/all?page=1&limit=10&status=active`);

// 6. Get Specific Promo Code
console.log("\n=== Testing Get Promo Code Details ===");
console.log(`GET ${BASE_URL}/admin/promo-uuid-here`);

// 7. Update Promo Code
console.log("\n=== Testing Update Promo Code ===");
console.log(`PUT ${BASE_URL}/admin/promo-uuid-here`);
console.log("Body:");
console.log(JSON.stringify({
  description: "Updated test promo code",
  discountValue: 30
}, null, 2));

// 8. Delete Promo Code
console.log("\n=== Testing Delete Promo Code ===");
console.log(`DELETE ${BASE_URL}/admin/promo-uuid-here`);

// ==================== CURL COMMANDS ====================

console.log("\n" + "=".repeat(60));
console.log("CURL COMMANDS FOR TESTING");
console.log("=".repeat(60));

// Apply Promo Code
console.log("\n1. Apply Promo Code:");
console.log(`curl -X POST ${BASE_URL}/apply \\
  -H "Content-Type: application/json" \\
  -d '{
    "promoCode": "WELCOME20",
    "userId": "${USER_ID}",
    "bookingAmount": 100.00
  }'`);

// Get Available Promos
console.log("\n2. Get Available Promo Codes:");
console.log(`curl -X GET ${BASE_URL}/user/${USER_ID}/available`);

// Get Used Promos
console.log("\n3. Get Used Promo Codes:");
console.log(`curl -X GET ${BASE_URL}/user/${USER_ID}/used`);

// Create Promo Code (Admin)
console.log("\n4. Create Promo Code (Admin):");
console.log(`curl -X POST ${BASE_URL}/admin/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "TEST25",
    "description": "Test promo code",
    "discountType": "percentage",
    "discountValue": 25,
    "maxDiscountAmount": 50.00,
    "minimumAmount": 20.00,
    "usageLimit": 5,
    "globalUsageLimit": 100,
    "isActive": true
  }'`);

// Get All Promo Codes (Admin)
console.log("\n5. Get All Promo Codes (Admin):");
console.log(`curl -X GET "${BASE_URL}/admin/all?page=1&limit=10&status=active"`);

// ==================== POSTMAN COLLECTION ====================

console.log("\n" + "=".repeat(60));
console.log("POSTMAN COLLECTION STRUCTURE");
console.log("=".repeat(60));

console.log(`
Create a Postman collection with these requests:

Collection: Productive Space - Promo Codes

1. Apply Promo Code
   - Method: POST
   - URL: ${BASE_URL}/apply
   - Body: Raw JSON with promoCode, userId, bookingAmount

2. Get User Available Promos
   - Method: GET
   - URL: ${BASE_URL}/user/{{userId}}/available
   - Variables: userId

3. Get User Used Promos
   - Method: GET
   - URL: ${BASE_URL}/user/{{userId}}/used
   - Variables: userId

4. Create Promo Code (Admin)
   - Method: POST
   - URL: ${BASE_URL}/admin/create
   - Body: Raw JSON with all promo code fields

5. Update Promo Code (Admin)
   - Method: PUT
   - URL: ${BASE_URL}/admin/{{promoCodeId}}
   - Variables: promoCodeId
   - Body: Raw JSON with fields to update

6. Delete Promo Code (Admin)
   - Method: DELETE
   - URL: ${BASE_URL}/admin/{{promoCodeId}}
   - Variables: promoCodeId

7. Get All Promo Codes (Admin)
   - Method: GET
   - URL: ${BASE_URL}/admin/all?page=1&limit=10&status=active

8. Get Promo Code Details (Admin)
   - Method: GET
   - URL: ${BASE_URL}/admin/{{promoCodeId}}
   - Variables: promoCodeId
`);

// ==================== TESTING SCENARIOS ====================

console.log("\n" + "=".repeat(60));
console.log("TESTING SCENARIOS");
console.log("=".repeat(60));

console.log(`
Test these scenarios to ensure your promo code system works correctly:

1. VALID PROMO CODE APPLICATION
   - Apply a valid promo code with sufficient booking amount
   - Verify discount calculation is correct
   - Check that promo code usage is recorded

2. INVALID PROMO CODE REJECTION
   - Try to apply expired promo code
   - Try to apply inactive promo code
   - Try to apply promo code below minimum amount

3. USAGE LIMIT ENFORCEMENT
   - Apply promo code multiple times (if usageLimit > 1)
   - Verify user cannot exceed usage limit
   - Check global usage limit enforcement

4. ADMIN OPERATIONS
   - Create new promo code
   - Update existing promo code
   - Delete unused promo code
   - View all promo codes with statistics

5. INTEGRATION WITH BOOKING
   - Create booking with promo code
   - Verify discount amount is applied
   - Check that total amount is calculated correctly
   - Ensure promo code usage is tracked

6. ERROR HANDLING
   - Test with missing required fields
   - Test with invalid data types
   - Test with non-existent promo codes
   - Test with unauthorized access attempts
`);

// ==================== SAMPLE DATA FOR TESTING ====================

console.log("\n" + "=".repeat(60));
console.log("SAMPLE DATA FOR TESTING");
console.log("=".repeat(60));

console.log(`
Use these sample promo codes for testing (from database_schema.sql):

1. WELCOME20
   - 20% off, max $50, min $30, 1 use per user, 100 global uses

2. SAVE10
   - 10% off, no max, min $20, 3 uses per user, 500 global uses

3. FLAT5
   - $5 off, no max, min $15, 5 uses per user, 200 global uses

4. FIRST50
   - 50% off, max $100, min $25, 1 use per user, 50 global uses

Test with different booking amounts:
- $15 (below minimum for most codes)
- $25 (minimum for FIRST50)
- $30 (minimum for WELCOME20)
- $50 (good for testing percentage calculations)
- $100 (good for testing max discount limits)
- $200 (high amount for testing)
`);

console.log("\n" + "=".repeat(60));
console.log("READY TO TEST! 🚀");
console.log("=".repeat(60));
console.log("\nMake sure to:");
console.log("1. Run the database_schema.sql in your Supabase database");
console.log("2. Update the BASE_URL and USER_ID variables above");
console.log("3. Test with the sample promo codes provided");
console.log("4. Check the console logs for all the test commands");
console.log("\nHappy testing! 🎉");
