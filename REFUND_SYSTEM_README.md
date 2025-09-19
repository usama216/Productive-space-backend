# Refund Credit System

## Overview
A comprehensive refund system that converts booking refunds into store credits with 30-day expiration. Users can use these credits for future bookings, reducing or eliminating the need for payment.

## Features
- ✅ **Refund Requests** - Users can request refunds for confirmed bookings
- ✅ **Admin Approval** - Admins can approve/reject refund requests
- ✅ **Store Credits** - Refunded amounts become store credits (30-day expiry)
- ✅ **Credit Usage** - Credits can be used for future bookings
- ✅ **Automatic Expiry** - Credits expire after 30 days
- ✅ **Email Notifications** - Refund confirmation emails
- ✅ **Admin Dashboard** - Manage refunds and view credit balances

## Database Schema

### New Tables
1. **UserCredits** - Stores user credit balances
2. **RefundTransactions** - Tracks refund history
3. **CreditUsage** - Records credit usage for bookings

### Updated Tables
1. **Booking** - Added refund status columns

## API Endpoints

### User Endpoints
- `POST /api/refund/request` - Request refund for booking
- `GET /api/refund/requests` - Get user's refund requests
- `GET /api/refund/credits` - Get user's credit balance
- `GET /api/refund/credit-usage` - Get credit usage history
- `POST /api/credit/calculate-payment` - Calculate payment after credits

### Admin Endpoints
- `GET /api/admin/refund/refunds` - Get all refund requests
- `POST /api/admin/refund/refunds/:id/approve` - Approve refund
- `POST /api/admin/refund/refunds/:id/reject` - Reject refund
- `GET /api/admin/refund/credits` - Get all user credits
- `GET /api/admin/refund/stats` - Get refund statistics

## Installation

### 1. Database Migration
```sql
-- Run the migration script
\i backend/migrations/add-refund-credit-system.sql
```

### 2. Install Dependencies
```bash
npm install node-cron
```

### 3. Environment Variables
No additional environment variables required.

## Usage Examples

### Request Refund
```javascript
POST /api/refund/request
{
  "bookingId": "uuid",
  "reason": "Change of plans"
}
```

### Calculate Payment with Credits
```javascript
POST /api/credit/calculate-payment
{
  "bookingAmount": 100.00
}

// Response
{
  "bookingAmount": 100.00,
  "availableCredit": 50.00,
  "paymentRequired": 50.00,
  "canUseCredit": true
}
```

### Approve Refund (Admin)
```javascript
POST /api/admin/refund/refunds/:refundId/approve
```

## Credit System Logic

### Credit Creation
- When refund is approved, credit is created with 30-day expiry
- Credit amount equals refund amount
- Credits are stored in `UserCredits` table

### Credit Usage
- Credits are used in order of expiry (oldest first)
- Partial usage allowed (e.g., $100 credit, $80 booking = $20 credit remaining)
- Fully used credits are marked as "USED"

### Payment Calculation
- `paymentRequired = max(0, bookingAmount - availableCredit)`
- If `paymentRequired = 0`, skip HitPay payment
- If `paymentRequired > 0`, use HitPay for remaining amount

## Automatic Cleanup

### Expired Credits
- Daily cleanup at 2 AM (Singapore time)
- Expired credits are marked as "EXPIRED"
- No automatic deletion (for audit purposes)

## Email Notifications

### Refund Confirmation
- Sent when refund is approved
- Includes credit amount and expiry date
- Matches booking confirmation design

## Frontend Integration

### UAM (User Account Management)
- **Wallet Tab** - Display credit balance and expiry
- **Credit History** - Show refund transactions
- **Usage History** - Show credit usage for bookings

### Booking Flow
- **Payment Calculation** - Show credit + payment breakdown
- **Credit Selection** - Allow users to choose credit usage
- **Payment Bypass** - Skip HitPay if credit covers full amount

## Testing

### Test Database Setup
```bash
node backend/test-refund-system.js
```

### Manual Testing
1. Create a booking
2. Request refund
3. Approve refund (admin)
4. Check credit balance
5. Use credit for new booking

## Security Considerations

- ✅ **Authentication** - All endpoints require valid JWT
- ✅ **Authorization** - Admin endpoints require admin role
- ✅ **Validation** - Input validation on all endpoints
- ✅ **Audit Trail** - All transactions are logged

## Performance

- ✅ **Indexes** - Database indexes on frequently queried columns
- ✅ **Cleanup** - Automatic cleanup of expired credits
- ✅ **Caching** - Credit calculations are optimized

## Monitoring

### Logs
- All refund operations are logged
- Credit usage is tracked
- Email sending status is logged

### Metrics
- Total refunded amount
- Credit usage statistics
- Expired credit counts

## Troubleshooting

### Common Issues
1. **Credits not showing** - Check expiry date and status
2. **Payment calculation wrong** - Verify credit amounts
3. **Email not sending** - Check email configuration
4. **Cleanup not running** - Check cron job status

### Debug Commands
```bash
# Check credit cleanup
node -e "require('./utils/creditHelper').cleanupExpiredCredits()"

# Test credit calculation
node -e "require('./utils/creditHelper').getTotalAvailableCredit('user-id')"
```

## Future Enhancements

- [ ] **Credit Transfer** - Transfer credits between users
- [ ] **Credit Expiry Notifications** - Email reminders before expiry
- [ ] **Bulk Refunds** - Process multiple refunds at once
- [ ] **Credit Analytics** - Detailed usage analytics
- [ ] **Credit Expiry Extensions** - Admin can extend credit expiry

## Support

For issues or questions:
1. Check the logs for error messages
2. Verify database schema is correct
3. Test with the provided test script
4. Contact the development team
