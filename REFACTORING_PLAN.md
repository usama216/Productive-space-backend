# Booking Controller Refactoring Plan

This document outlines the plan to split the 3,736-line `bookingController.js` into smaller, maintainable modules.

## File Structure

### 1. `bookingCoreController.js` ✅ CREATED
- `createBooking` (lines 19-363)
- `getBookingById` (lines 364-444)
- `getAdminBookingDetails` (lines 447-598)
- `getAllBookings` (lines 2110-2339)
- `updateBooking` (lines 2511-2570)
- `cancelBooking` (lines 2572-2616)

### 2. `bookingPaymentController.js` - TO CREATE
- `confirmBookingPayment` (lines 600-1191)
- `confirmBookingWithPackage` (lines 3109-3235)
- `getBookingPaymentDetails` (lines 1643-1893)

### 3. `bookingExtensionController.js` - TO CREATE
- `extendBooking` (lines 3237-3353)
- `confirmExtensionPayment` (lines 3355-3735)

### 4. `bookingUtilityController.js` - TO CREATE
- `getBookedSeats` (lines 1193-1298)
- `validatePassForBooking` (lines 1301-1337)
- `applyPassToBooking` (lines 1339-1374)
- `getUserPassBalance` (lines 1376-1412)

### 5. `userBookingController.js` - TO CREATE
- `getUserBookings` (lines 1415-1640)
- `getUserBookingStats` (lines 2066-2107)
- `getUserBookingAnalytics` (lines 1895-2002)
- `getUserDashboardSummary` (lines 2004-2064)

### 6. `adminBookingController.js` - TO CREATE
- `getBookingAnalytics` (lines 2341-2453)
- `getDashboardSummary` (lines 2455-2509)

### 7. `userManagementController.js` - TO CREATE
- `getAllUsers` (lines 2619-2723)
- `getUserAnalytics` (lines 2725-2834)
- `getUserManagementSummary` (lines 2836-2893)
- `verifyStudentAccount` (lines 2895-3018)
- `getVerificationExpiry` (lines 3020-3039)
- `deleteUser` (lines 3041-3107)

## Shared Imports
All files will need:
```javascript
const supabase = require("../config/database");
const { logBookingActivity, ACTIVITY_TYPES } = require("../utils/bookingActivityLogger");
```

Additional imports as needed per controller.

## Next Steps
1. Create remaining controller files
2. Update `routes/booking.js` to import from new locations
3. Test all endpoints
4. Remove original `bookingController.js` (or keep as backup)

