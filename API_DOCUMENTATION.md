# Productive Space Backend - Promo Code API Documentation

## Overview
This document describes the complete promo code system APIs for the Productive Space Backend. The system allows users to apply promo codes during booking and admins to manage promo codes.

## Base URL
```
https://your-domain.com/api/promocode
```

## Authentication
- **User APIs**: Require valid user ID (passed as parameter or in request body)
- **Admin APIs**: Should implement proper admin authentication (JWT tokens, admin roles, etc.)

---

## 🎫 USER/CLIENT APIs

### 1. Apply Promo Code
**Apply a promo code during booking to get discount calculation.**

- **Endpoint**: `POST /apply`
- **Description**: Validates and applies a promo code, returns discount calculation
- **Use Case**: Called when user enters promo code during booking process

#### Request Body
```json
{
  "promoCode": "WELCOME20",
  "userId": "user-uuid-here",
  "bookingAmount": 100.00
}
```

#### Response (Success - 200)
```json
{
  "message": "Promo code applied successfully",
  "promoCode": {
    "id": "promo-uuid",
    "code": "WELCOME20",
    "discountType": "PERCENTAGE",
    "discountValue": 20,
    "maxDiscountAmount": 50.00,
    "minimumAmount": 30.00
  },
  "calculation": {
    "originalAmount": 100.00,
    "discountAmount": 20.00,
    "finalAmount": 80.00
  }
}
```

#### Response (Error - 400/404)
```json
{
  "error": "Invalid promo code",
  "message": "The promo code you entered is not valid or has expired"
}
```

#### Common Error Scenarios
- **Invalid/Expired Code**: Promo code doesn't exist or has expired
- **Minimum Amount Not Met**: Booking amount below required minimum
- **Already Used**: User has already used this promo code
- **Usage Limit Reached**: User or global usage limit exceeded

---

### 2. Get User's Available Promo Codes
**Get all valid promo codes that the user can still use.**

- **Endpoint**: `GET /user/:userId/available`
- **Description**: Returns active promo codes available for the specified user
- **Use Case**: Display available promo codes in user dashboard

#### Request
```
GET /api/promocode/user/123e4567-e89b-12d3-a456-426614174000/available
```

#### Response (Success - 200)
```json
{
  "availablePromos": [
    {
      "id": "promo-uuid-1",
      "code": "SAVE10",
      "description": "Save 10% on any booking",
      "discountType": "PERCENTAGE",
      "discountValue": 10,
      "maxDiscountAmount": null,
      "minimumAmount": 20.00,
      "activeFrom": "2025-01-01T00:00:00Z",
      "activeTo": "2025-06-30T23:59:59Z",
      "maxUsagePerUser": 3,
      "userUsageCount": 1,
      "remainingUses": 2
    }
  ],
  "totalCount": 1
}
```

---

### 3. Get User's Used Promo Codes
**Get history of promo codes used by the user.**

- **Endpoint**: `GET /user/:userId/used`
- **Description**: Returns all promo codes the user has previously used
- **Use Case**: Show user's promo code usage history

#### Request
```
GET /api/promocode/user/123e4567-e89b-12d3-a456-426614174000/used
```

#### Response (Success - 200)
```json
{
  "usedPromos": [
    {
      "id": "usage-uuid",
      "promoCodeId": "promo-uuid",
      "userId": "user-uuid",
      "bookingId": "booking-uuid",
      "usedAt": "2025-01-15T10:30:00Z",
      "createdAt": "2025-01-15T10:30:00Z",
      "PromoCode": {
        "id": "promo-uuid",
        "code": "WELCOME20",
        "description": "Welcome discount for new users",
        "discountType": "PERCENTAGE",
        "discountValue": 20,
        "maxDiscountAmount": 50.00
      }
    }
  ],
  "totalCount": 1
}
```

---

## 🔧 ADMIN APIs

### 4. Create Promo Code
**Create a new promo code (Admin only).**

- **Endpoint**: `POST /admin/create`
- **Description**: Creates a new promo code with specified parameters
- **Use Case**: Admin creates promotional offers

#### Request Body
```json
{
  "code": "SUMMER25",
  "description": "Summer season discount",
  "discountType": "PERCENTAGE",
  "discountValue": 25,
  "maxDiscountAmount": 75.00,
  "minimumAmount": 40.00,
  "activeFrom": "2025-06-01T00:00:00Z",
  "activeTo": "2025-08-31T23:59:59Z",
  "maxUsagePerUser": 2,
  "maxTotalUsage": 1000,
  "isActive": true
}
```

#### Response (Success - 201)
```json
{
  "message": "Promo code created successfully",
  "promoCode": {
    "id": "new-promo-uuid",
    "code": "SUMMER25",
    "description": "Summer season discount",
    "discountType": "PERCENTAGE",
    "discountValue": 25,
    "maxDiscountAmount": 75.00,
    "minimumAmount": 40.00,
    "activeFrom": "2025-06-01T00:00:00Z",
    "activeTo": "2025-08-31T23:59:59Z",
    "maxUsagePerUser": 2,
    "maxTotalUsage": 1000,
    "isActive": true,
    "createdAt": "2025-01-20T15:30:00Z",
    "updatedAt": "2025-01-20T15:30:00Z"
  }
}
```

---

### 5. Update Promo Code
**Update an existing promo code (Admin only).**

- **Endpoint**: `PUT /admin/:id`
- **Description**: Updates specific fields of an existing promo code
- **Use Case**: Admin modifies promo code details

#### Request Body
```json
{
  "description": "Updated summer season discount",
  "discountValue": 30,
  "maxDiscountAmount": 100.00
}
```

#### Response (Success - 200)
```json
{
  "message": "Promo code updated successfully",
  "promoCode": {
    "id": "promo-uuid",
    "code": "SUMMER25",
    "description": "Updated summer season discount",
    "discountType": "PERCENTAGE",
    "discountValue": 30,
    "maxDiscountAmount": 100.00,
    "updatedAt": "2025-01-20T16:00:00Z"
  }
}
```

---

### 6. Delete Promo Code
**Delete a promo code (Admin only).**

- **Endpoint**: `DELETE /admin/:id`
- **Description**: Removes a promo code (only if never used)
- **Use Case**: Admin removes unused promo codes

#### Request
```
DELETE /api/promocode/admin/promo-uuid-here
```

#### Response (Success - 200)
```json
{
  "message": "Promo code deleted successfully",
  "deletedPromoCode": {
    "id": "promo-uuid",
    "code": "SUMMER25",
    "description": "Summer season discount"
  }
}
```

#### Response (Error - 400)
```json
{
  "error": "Cannot delete used promo code",
  "message": "This promo code has been used and cannot be deleted. Consider deactivating it instead."
}
```

---

### 7. Get All Promo Codes
**Get all promo codes with pagination and filters (Admin only).**

- **Endpoint**: `GET /admin/all`
- **Description**: Returns paginated list of all promo codes with usage statistics
- **Use Case**: Admin dashboard to view all promo codes

#### Query Parameters
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search in code or description
- `status` (optional): Filter by status ("active", "inactive")

#### Request
```
GET /api/promocode/admin/all?page=1&limit=10&status=active&search=SUMMER
```

#### Response (Success - 200)
```json
{
  "promoCodes": [
    {
      "id": "promo-uuid",
      "code": "SUMMER25",
      "description": "Summer season discount",
      "discountType": "PERCENTAGE",
      "discountValue": 25,
      "isActive": true,
      "usageCount": 45,
      "isExpired": false,
      "remainingGlobalUses": 955
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

### 8. Get Promo Code Details
**Get detailed information about a specific promo code (Admin only).**

- **Endpoint**: `GET /admin/:id`
- **Description**: Returns comprehensive details including usage history
- **Use Case**: Admin views specific promo code analytics

#### Request
```
GET /api/promocode/admin/promo-uuid-here
```

#### Response (Success - 200)
```json
{
  "promoCode": {
    "id": "promo-uuid",
    "code": "SUMMER25",
    "description": "Summer season discount",
    "discountType": "PERCENTAGE",
    "discountValue": 25,
    "maxDiscountAmount": 75.00,
    "minimumAmount": 40.00,
    "activeFrom": "2025-06-01T00:00:00Z",
    "activeTo": "2025-08-31T23:59:59Z",
    "maxUsagePerUser": 2,
    "maxTotalUsage": 1000,
    "isActive": true,
    "usageCount": 45,
    "isExpired": false,
    "isActive": true,
    "remainingGlobalUses": 955,
    "PromoCodeUsage": [
      {
        "id": "usage-uuid",
        "userId": "user-uuid",
        "usedAt": "2025-01-15T10:30:00Z",
        "User": {
          "id": "user-uuid",
          "email": "user@example.com",
          "name": "John Doe"
        }
      }
    ]
  }
}
```

---

## 🔄 INTEGRATION WITH BOOKING SYSTEM

### Updated Booking Creation
When creating a booking with a promo code, include these additional fields:

```json
{
  "userId": "user-uuid",
  "location": "Main Hall",
  "startAt": "2025-01-25T10:00:00Z",
  "endAt": "2025-01-25T12:00:00Z",
  "totalCost": 100.00,
  "promoCodeId": "promo-uuid", // Applied promo code ID
  "discountAmount": 20.00,     // Amount discounted
  "totalAmount": 80.00         // Final amount after discount
}
```

### Promo Code Usage Tracking
The system automatically records promo code usage when a booking is created with a `promoCodeId`.

---

## 📊 PROMO CODE TYPES

### Percentage Discount
- **Example**: 20% off
- **Calculation**: `discount = min(amount * 0.20, maxDiscountAmount)`
- **Use Case**: Seasonal sales, member discounts

### Fixed Amount Discount
- **Example**: $10 off
- **Calculation**: `discount = fixedAmount`
- **Use Case**: First-time user bonuses, referral rewards

---

## ⚠️ VALIDATION RULES

### Promo Code Validation
1. **Code Format**: Must be unique, case-insensitive
2. **Validity Period**: Must be within activeFrom and activeTo dates
3. **Minimum Amount**: Booking must meet minimum amount requirement
4. **Usage Limits**: User and global usage limits enforced
5. **Active Status**: Only active promo codes can be used

### Business Rules
1. **One Promo Per Booking**: Only one promo code per booking
2. **No Stacking**: Promo codes cannot be combined
3. **Usage Tracking**: All usage is logged for analytics
4. **Expiration**: Expired codes are automatically invalidated

---

## 🚀 FRONTEND IMPLEMENTATION GUIDE

### 📱 COMPLETE FRONTEND COMPONENTS

#### 1. Promo Code Input Component
```javascript
// components/PromoCodeInput.js
import React, { useState } from 'react';

const PromoCodeInput = ({ onApplyPromo, onRemovePromo, appliedPromo, totalAmount }) => {
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/promocode/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promoCode: promoCode.trim(),
          userId: 'current-user-id', // Get from auth context
          bookingAmount: totalAmount
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        onApplyPromo(data);
        setPromoCode('');
      } else {
        setError(data.message || 'Invalid promo code');
      }
    } catch (err) {
      setError('Failed to apply promo code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePromo = () => {
    onRemovePromo();
  };

  return (
    <div className="promo-code-section">
      {!appliedPromo ? (
        <div className="promo-input">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter promo code"
            className="promo-input-field"
          />
          <button
            onClick={handleApplyPromo}
            disabled={isLoading || !promoCode.trim()}
            className="apply-promo-btn"
          >
            {isLoading ? 'Applying...' : 'Apply'}
          </button>
        </div>
      ) : (
        <div className="applied-promo">
          <span className="promo-code">{appliedPromo.promoCode.code}</span>
          <span className="discount-amount">
            -${appliedPromo.calculation.discountAmount}
          </span>
          <button onClick={handleRemovePromo} className="remove-promo-btn">
            Remove
          </button>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default PromoCodeInput;
```

#### 2. Enhanced Booking Form
```javascript
// components/BookingForm.js
import React, { useState, useEffect } from 'react';
import PromoCodeInput from './PromoCodeInput';

const BookingForm = () => {
  const [formData, setFormData] = useState({
    location: '',
    startAt: '',
    endAt: '',
    pax: 1,
    students: 0,
    members: 1,
    tutors: 0,
    memberType: 'MEMBER'
  });
  
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [totalCost, setTotalCost] = useState(0);
  const [finalAmount, setFinalAmount] = useState(0);

  // Calculate total cost based on form data
  useEffect(() => {
    const baseCost = calculateBaseCost(formData);
    setTotalCost(baseCost);
    
    if (appliedPromo) {
      setFinalAmount(appliedPromo.calculation.finalAmount);
    } else {
      setFinalAmount(baseCost);
    }
  }, [formData, appliedPromo]);

  const handleApplyPromo = (promoData) => {
    setAppliedPromo(promoData);
    setFinalAmount(promoData.calculation.finalAmount);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setFinalAmount(totalCost);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          totalCost: totalCost,
          totalAmount: finalAmount,
          promoCodeId: appliedPromo?.promoCode.id || null,
          discountAmount: appliedPromo?.calculation.discountAmount || 0,
          userId: 'current-user-id', // Get from auth context
          confirmedPayment: false
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Booking created:', data);
        // Redirect to payment or confirmation
      } else {
        console.error('Booking failed:', data.error);
      }
    } catch (err) {
      console.error('Booking error:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="booking-form">
      {/* Your existing form fields */}
      
      {/* Promo Code Section */}
      <div className="form-section">
        <h3>Promo Code</h3>
        <PromoCodeInput
          onApplyPromo={handleApplyPromo}
          onRemovePromo={handleRemovePromo}
          appliedPromo={appliedPromo}
          totalAmount={totalCost}
        />
      </div>
      
      {/* Price Summary */}
      <div className="price-summary">
        <div className="price-row">
          <span>Base Cost:</span>
          <span>${totalCost}</span>
        </div>
        
        {appliedPromo && (
          <>
            <div className="price-row discount">
              <span>Discount ({appliedPromo.promoCode.code}):</span>
              <span>-${appliedPromo.calculation.discountAmount}</span>
            </div>
            <div className="price-row total">
              <span>Final Amount:</span>
              <span>${finalAmount}</span>
            </div>
          </>
        )}
      </div>
      
      <button type="submit" className="submit-btn">
        Book Now - ${finalAmount}
      </button>
    </form>
  );
};

export default BookingForm;
```

#### 3. Available Promo Codes Display
```javascript
// components/AvailablePromoCodes.js
import React, { useState, useEffect } from 'react';

const AvailablePromoCodes = ({ userId }) => {
  const [availablePromos, setAvailablePromos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAvailablePromos();
  }, [userId]);

  const fetchAvailablePromos = async () => {
    try {
      const response = await fetch(`/api/promocode/user/${userId}/available`);
      const data = await response.json();
      
      if (response.ok) {
        setAvailablePromos(data.availablePromos);
      }
    } catch (err) {
      console.error('Failed to fetch promo codes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div>Loading promo codes...</div>;

  return (
    <div className="available-promos">
      <h3>Available Promo Codes</h3>
      
      {availablePromos.length === 0 ? (
        <p>No promo codes available at the moment.</p>
      ) : (
        <div className="promo-codes-grid">
          {availablePromos.map((promo) => (
            <div key={promo.id} className="promo-card">
              <div className="promo-header">
                <h4>{promo.code}</h4>
                <span className="promo-category">{promo.category}</span>
              </div>
              
              <p className="promo-description">{promo.description}</p>
              
              <div className="promo-details">
                <div className="discount-info">
                  {promo.discountType === 'PERCENTAGE' ? (
                    <span className="discount-value">{promo.discountValue}% OFF</span>
                  ) : (
                    <span className="discount-value">${promo.discountValue} OFF</span>
                  )}
                </div>
                
                {promo.minimumAmount > 0 && (
                  <div className="minimum-amount">
                    Min: ${promo.minimumAmount}
                  </div>
                )}
                
                <div className="usage-info">
                  {promo.remainingUses > 1 ? (
                    <span>Use {promo.remainingUses} more times</span>
                  ) : (
                    <span>One-time use</span>
                  )}
                </div>
              </div>
              
              {promo.activeTo && (
                <div className="expiry-info">
                  Expires: {new Date(promo.activeTo).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailablePromoCodes;
```

### 🎨 COMPLETE CSS STYLING
```css
/* styles/promoCode.css */
.promo-code-section {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
}

.promo-input {
  display: flex;
  gap: 10px;
}

.promo-input-field {
  flex: 1;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
}

.apply-promo-btn {
  padding: 12px 24px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.apply-promo-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.applied-promo {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #d4edda;
  border: 1px solid #c3e6cb;
  border-radius: 6px;
}

.promo-code {
  font-weight: bold;
  color: #155724;
}

.discount-amount {
  font-size: 18px;
  font-weight: bold;
  color: #28a745;
}

.remove-promo-btn {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error-message {
  color: #dc3545;
  margin-top: 10px;
  font-size: 14px;
}

.price-summary {
  margin: 20px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.price-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.price-row.discount {
  color: #28a745;
  font-weight: 600;
}

.price-row.total {
  font-size: 18px;
  font-weight: bold;
  border-bottom: none;
}

.promo-codes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.promo-card {
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.promo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.promo-category {
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.discount-value {
  font-size: 20px;
  font-weight: bold;
  color: #28a745;
}

.expiry-info {
  margin-top: 15px;
  padding: 10px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  color: #856404;
  font-size: 14px;
}
```

### 🔄 COMPLETE USER FLOW IMPLEMENTATION

#### Step 1: Add Promo Code Input to Booking Form
```javascript
// In your existing booking form
import PromoCodeInput from './components/PromoCodeInput';

// Add this section to your form
<div className="form-section">
  <h3>Promo Code</h3>
  <PromoCodeInput
    onApplyPromo={handleApplyPromo}
    onRemovePromo={handleRemovePromo}
    appliedPromo={appliedPromo}
    totalAmount={totalCost}
  />
</div>
```

#### Step 2: Update Booking Submission
```javascript
// Update your existing booking submission
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const bookingPayload = {
    // ... all your existing fields
    totalCost: baseCost,
    totalAmount: appliedPromo ? finalAmount : baseCost,
    promoCodeId: appliedPromo?.promoCode.id || null,
    discountAmount: appliedPromo?.calculation.discountAmount || 0
  };
  
  // Your existing API call
  const response = await fetch('/api/booking/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookingPayload)
  });
};
```

#### Step 3: Add Available Promo Codes to User Dashboard
```javascript
// In your user dashboard
import AvailablePromoCodes from './components/AvailablePromoCodes';

// Add this component
<AvailablePromoCodes userId={currentUser.id} />
```

### 📱 RESPONSIVE DESIGN CONSIDERATIONS

#### Mobile-First Approach
```css
/* Mobile styles */
@media (max-width: 768px) {
  .promo-input {
    flex-direction: column;
  }
  
  .promo-codes-grid {
    grid-template-columns: 1fr;
  }
  
  .applied-promo {
    flex-direction: column;
    text-align: center;
  }
}
```

#### Tablet and Desktop
```css
/* Tablet styles */
@media (min-width: 769px) and (max-width: 1024px) {
  .promo-codes-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop styles */
@media (min-width: 1025px) {
  .promo-codes-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### 🧪 TESTING YOUR IMPLEMENTATION

#### Test Scenarios
1. **Apply Valid Promo Code**
   - Enter a valid code (e.g., "WELCOME20")
   - Verify discount calculation
   - Check final amount update

2. **Remove Promo Code**
   - Apply a promo code
   - Click remove button
   - Verify original price restoration

3. **Invalid Promo Code**
   - Enter invalid/expired code
   - Verify error message display
   - Check form state remains unchanged

4. **Booking with Promo Code**
   - Apply promo code
   - Submit booking
   - Verify promo code usage recording

#### Test Data
Use these sample promo codes for testing:
- **WELCOME20**: 20% off, minimum $50
- **STUDENT15**: 15% off, minimum $30
- **FIXED10**: $10 off, minimum $100
- **MEMBER25**: 25% off, minimum $75

---

## 🔐 SECURITY CONSIDERATIONS

### Admin Authentication
- Implement proper admin role verification
- Use JWT tokens or session-based authentication
- Rate limiting for admin operations
- Audit logging for all admin actions

### User Validation
- Validate user ID ownership
- Prevent promo code abuse
- Monitor unusual usage patterns
- Implement fraud detection

---

## 📈 MONITORING & ANALYTICS

### Key Metrics
- Promo code usage rates
- Discount amount distribution
- User engagement with promotions
- Revenue impact analysis

### Reporting
- Daily/weekly/monthly usage reports
- Top performing promo codes
- User behavior patterns
- ROI calculations

---

## 🧪 TESTING

### Test Scenarios
1. **Valid Promo Code Application**
2. **Expired Code Rejection**
3. **Usage Limit Enforcement**
4. **Minimum Amount Validation**
5. **Admin CRUD Operations**
6. **Error Handling**

### Test Data
Use the sample promo codes provided in the database schema for testing.

---

## 🔧 TROUBLESHOOTING GUIDE

### Common Issues and Solutions

#### 1. Promo Code Not Applying
**Problem**: Promo code input shows no response
**Solution**: Check browser console for errors, verify API endpoint URL

#### 2. Discount Not Calculating
**Problem**: Promo code applies but no discount shown
**Solution**: Verify `discountAmount` calculation in response, check CSS for hidden elements

#### 3. Booking Creation Fails
**Problem**: Error when submitting booking with promo code
**Solution**: Check that all required fields are included, verify `promoCodeId` format

#### 4. Promo Codes Not Loading
**Problem**: Available promo codes section shows loading indefinitely
**Solution**: Check API response, verify user ID format, check network tab for failed requests

#### 5. Styling Issues
**Problem**: Promo code components look broken
**Solution**: Ensure CSS file is imported, check for conflicting styles, verify class names

---

## 📱 MOBILE OPTIMIZATION

### Touch-Friendly Design
```css
/* Ensure buttons are large enough for touch */
.apply-promo-btn,
.remove-promo-btn {
  min-height: 44px;
  min-width: 44px;
}

/* Improve input field touch experience */
.promo-input-field {
  min-height: 44px;
  font-size: 16px; /* Prevents zoom on iOS */
}
```

### Performance Optimization
```javascript
// Debounce promo code input to avoid excessive API calls
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const debouncedApplyPromo = debounce(handleApplyPromo, 500);
```

---

## 🎨 THEME CUSTOMIZATION

### Color Variables
```css
:root {
  --primary-color: #007bff;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
  --light-color: #f8f9fa;
  --dark-color: #343a40;
}

/* Use variables in your components */
.apply-promo-btn {
  background: var(--success-color);
}

.remove-promo-btn {
  background: var(--danger-color);
}
```

### Dark Mode Support
```css
@media (prefers-color-scheme: dark) {
  .promo-code-section {
    background: #2d3748;
    border-color: #4a5568;
    color: #e2e8f0;
  }
  
  .promo-input-field {
    background: #4a5568;
    border-color: #718096;
    color: #e2e8f0;
  }
}
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Test all promo code functionality locally
- [ ] Verify API endpoints are accessible
- [ ] Test with sample promo codes
- [ ] Check responsive design on all devices
- [ ] Validate error handling

### Post-Deployment
- [ ] Monitor API response times
- [ ] Check error logs for issues
- [ ] Verify promo code usage tracking
- [ ] Test user experience on production
- [ ] Monitor performance metrics

---

## 📞 SUPPORT & MAINTENANCE

### Regular Maintenance
- Monitor promo code usage patterns
- Update expired promo codes
- Analyze performance metrics
- Backup promo code data regularly

### User Support
- Provide clear error messages
- Document common issues
- Create user guides for promo codes
- Monitor user feedback

---

## 📞 SUPPORT

For technical support or questions about the promo code system:
- **Email**: support@myproductivespace.com
- **Documentation**: This API documentation
- **Database Schema**: `database_schema.sql`
- **Sample Data**: Included in schema file
- **Frontend Components**: Complete code provided above

---

## 🎉 CONCLUSION

Your promo code system is now complete with:
- ✅ **8 fully functional APIs** for all operations
- ✅ **Complete frontend components** ready for implementation
- ✅ **Responsive design** for all devices
- ✅ **Comprehensive testing guide** for verification
- ✅ **Step-by-step implementation** instructions
- ✅ **Troubleshooting guide** for common issues

**You're ready to implement a production-ready promo code system in your frontend!** 🚀

---

## 🚀 COMPLETE API ENDPOINTS SUMMARY

### User/Client Endpoints
| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| `POST` | `/api/promocode/apply` | Apply promo code during booking | User enters promo code |
| `GET` | `/api/promocode/user/:userId/available` | Get user's available promo codes | Display in dashboard |
| `GET` | `/api/promocode/user/:userId/used` | Get user's used promo codes | Show usage history |

### Admin Endpoints
| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| `POST` | `/api/promocode/admin/create` | Create new promo code | Admin creates offers |
| `PUT` | `/api/promocode/admin/:id` | Update existing promo code | Admin modifies codes |
| `DELETE` | `/api/promocode/admin/:id` | Delete promo code | Admin removes codes |
| `GET` | `/api/promocode/admin/all` | Get all promo codes | Admin dashboard |
| `GET` | `/api/promocode/admin/:id` | Get specific promo code | Admin analytics |

### Booking Integration Endpoint
| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| `POST` | `/api/booking/create` | Create booking with promo code | Final booking submission |

---

## 📋 COMPLETE REQUEST/RESPONSE EXAMPLES

### 1. Apply Promo Code Flow
```javascript
// Step 1: User enters promo code
const applyPromoCode = async (promoCode, userId, bookingAmount) => {
  const response = await fetch('/api/promocode/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promoCode: 'WELCOME20',
      userId: 'user-123',
      bookingAmount: 100.00
    })
  });
  
  const data = await response.json();
  return data;
};

// Step 2: Use promo code data in booking
const createBookingWithPromo = async (bookingData, appliedPromo) => {
  const response = await fetch('/api/booking/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...bookingData,
      totalCost: 100.00,
      totalAmount: appliedPromo.calculation.finalAmount,
      promoCodeId: appliedPromo.promoCode.id,
      discountAmount: appliedPromo.calculation.discountAmount
    })
  });
  
  const data = await response.json();
  return data;
};
```

### 2. Get Available Promo Codes
```javascript
const getAvailablePromoCodes = async (userId) => {
  const response = await fetch(`/api/promocode/user/${userId}/available`);
  const data = await response.json();
  
  if (response.ok) {
    return data.availablePromos;
  } else {
    throw new Error(data.error);
  }
};
```

### 3. Admin Create Promo Code
```javascript
const createPromoCode = async (promoData) => {
  const response = await fetch('/api/promocode/admin/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'SUMMER25',
      description: 'Summer season discount',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      maxDiscountAmount: 75.00,
      minimumAmount: 40.00,
      activeFrom: '2025-06-01T00:00:00Z',
      activeTo: '2025-08-31T23:59:59Z',
      maxUsagePerUser: 2,
      maxTotalUsage: 1000,
      isActive: true
    })
  });
  
  const data = await response.json();
  return data;
};
```

---

## 🚀 COMPLETE API ENDPOINTS SUMMARY

### User/Client Endpoints
| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| `POST` | `/api/promocode/apply` | Apply promo code during booking | User enters promo code |
| `GET` | `/api/promocode/user/:userId/available` | Get user's available promo codes | Display in dashboard |
| `GET` | `/api/promocode/user/:userId/used` | Get user's used promo codes | Show usage history |

### Admin Endpoints
| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| `POST` | `/api/promocode/admin/create` | Create new promo code | Admin creates offers |
| `PUT` | `/api/promocode/admin/:id` | Update existing promo code | Admin modifies codes |
| `DELETE` | `/api/promocode/admin/:id` | Delete promo code | Admin removes codes |
| `GET` | `/api/promocode/admin/all` | Get all promo codes | Admin dashboard |
| `GET` | `/api/promocode/admin/:id` | Get specific promo code | Admin analytics |

### Booking Integration Endpoint
| Method | Endpoint | Description | Use Case |
|--------|----------|-------------|----------|
| `POST` | `/api/booking/create` | Create booking with promo code | Final booking submission |

---

## 📋 COMPLETE REQUEST/RESPONSE EXAMPLES

### 1. Apply Promo Code Flow
```javascript
// Step 1: User enters promo code
const applyPromoCode = async (promoCode, userId, bookingAmount) => {
  const response = await fetch('/api/promocode/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promoCode: 'WELCOME20',
      userId: 'user-123',
      bookingAmount: 100.00
    })
  });
  
  const data = await response.json();
  return data;
};

// Step 2: Use promo code data in booking
const createBookingWithPromo = async (bookingData, appliedPromo) => {
  const response = await fetch('/api/booking/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...bookingData,
      totalCost: 100.00,
      totalAmount: appliedPromo.calculation.finalAmount,
      promoCodeId: appliedPromo.promoCode.id,
      discountAmount: appliedPromo.calculation.discountAmount
    })
  });
  
  const data = await response.json();
  return data;
};
```

### 2. Get Available Promo Codes
```javascript
const getAvailablePromoCodes = async (userId) => {
  const response = await fetch(`/api/promocode/user/${userId}/available`);
  const data = await response.json();
  
  if (response.ok) {
    return data.availablePromos;
  } else {
    throw new Error(data.error);
  }
};
```

### 3. Admin Create Promo Code
```javascript
const createPromoCode = async (promoData) => {
  const response = await fetch('/api/promocode/admin/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'SUMMER25',
      description: 'Summer season discount',
      discountType: 'PERCENTAGE',
      discountValue: 25,
      maxDiscountAmount: 75.00,
      minimumAmount: 40.00,
      activeFrom: '2025-06-01T00:00:00Z',
      activeTo: '2025-08-31T23:59:59Z',
      maxUsagePerUser: 2,
      maxTotalUsage: 1000,
      isActive: true
    })
  });
  
  const data = await response.json();
  return data;
};
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### Frontend Setup
- [ ] Create `PromoCodeInput` component
- [ ] Create `AvailablePromoCodes` component
- [ ] Update existing `BookingForm` component
- [ ] Add CSS styling for promo code components
- [ ] Test promo code input functionality
- [ ] Test promo code validation
- [ ] Test discount calculation display
- [ ] Test booking submission with promo code

### API Integration
- [ ] Test `/api/promocode/apply` endpoint
- [ ] Test `/api/promocode/user/:userId/available` endpoint
- [ ] Test `/api/promocode/user/:userId/used` endpoint
- [ ] Test `/api/booking/create` with promo code fields
- [ ] Verify promo code usage tracking

### User Experience
- [ ] Add promo code input to booking form
- [ ] Display available promo codes in user dashboard
- [ ] Show discount calculation in real-time
- [ ] Handle error messages gracefully
- [ ] Implement responsive design
- [ ] Test on mobile and desktop

### Admin Features (Optional)
- [ ] Create admin promo code management interface
- [ ] Implement promo code CRUD operations
- [ ] Add usage analytics dashboard
- [ ] Test admin authentication and authorization

---

## 🔧 TROUBLESHOOTING GUIDE

### Common Issues and Solutions

#### 1. Promo Code Not Applying
**Problem**: Promo code input shows no response
**Solution**: Check browser console for errors, verify API endpoint URL

#### 2. Discount Not Calculating
**Problem**: Promo code applies but no discount shown
**Solution**: Verify `discountAmount` calculation in response, check CSS for hidden elements

#### 3. Booking Creation Fails
**Problem**: Error when submitting booking with promo code
**Solution**: Check that all required fields are included, verify `promoCodeId` format

#### 4. Promo Codes Not Loading
**Problem**: Available promo codes section shows loading indefinitely
**Solution**: Check API response, verify user ID format, check network tab for failed requests

#### 5. Styling Issues
**Problem**: Promo code components look broken
**Solution**: Ensure CSS file is imported, check for conflicting styles, verify class names

---

## 📱 MOBILE OPTIMIZATION

### Touch-Friendly Design
```css
/* Ensure buttons are large enough for touch */
.apply-promo-btn,
.remove-promo-btn {
  min-height: 44px;
  min-width: 44px;
}

/* Improve input field touch experience */
.promo-input-field {
  min-height: 44px;
  font-size: 16px; /* Prevents zoom on iOS */
}
```

### Performance Optimization
```javascript
// Debounce promo code input to avoid excessive API calls
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const debouncedApplyPromo = debounce(handleApplyPromo, 500);
```

---

## 🎨 THEME CUSTOMIZATION

### Color Variables
```css
:root {
  --primary-color: #007bff;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
  --light-color: #f8f9fa;
  --dark-color: #343a40;
}

/* Use variables in your components */
.apply-promo-btn {
  background: var(--success-color);
}

.remove-promo-btn {
  background: var(--danger-color);
}
```

### Dark Mode Support
```css
@media (prefers-color-scheme: dark) {
  .promo-code-section {
    background: #2d3748;
    border-color: #4a5568;
    color: #e2e8f0;
  }
  
  .promo-input-field {
    background: #4a5568;
    border-color: #718096;
    color: #e2e8f0;
  }
}
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Test all promo code functionality locally
- [ ] Verify API endpoints are accessible
- [ ] Test with sample promo codes
- [ ] Check responsive design on all devices
- [ ] Validate error handling

### Post-Deployment
- [ ] Monitor API response times
- [ ] Check error logs for issues
- [ ] Verify promo code usage tracking
- [ ] Test user experience on production
- [ ] Monitor performance metrics

---

## 📞 SUPPORT & MAINTENANCE

### Regular Maintenance
- Monitor promo code usage patterns
- Update expired promo codes
- Analyze performance metrics
- Backup promo code data regularly

### User Support
- Provide clear error messages
- Document common issues
- Create user guides for promo codes
- Monitor user feedback

---

## 🎉 CONCLUSION

Your promo code system is now complete with:
- ✅ **8 fully functional APIs** for all operations
- ✅ **Complete frontend components** ready for implementation
- ✅ **Responsive design** for all devices
- ✅ **Comprehensive testing guide** for verification
- ✅ **Step-by-step implementation** instructions
- ✅ **Troubleshooting guide** for common issues

**You're ready to implement a production-ready promo code system in your frontend!** 🚀
