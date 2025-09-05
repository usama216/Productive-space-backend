/**
 * Shared calculation utilities to ensure consistency between website, PDF, and email
 */

/**
 * Calculate card processing fee and amounts correctly
 * @param {number} totalAmount - The total amount paid by customer
 * @param {string} paymentMethod - The payment method used
 * @returns {object} - Calculation results
 */
function calculatePaymentAmounts(totalAmount, paymentMethod) {
  const isCardPayment = paymentMethod && (
    paymentMethod.toLowerCase().includes('card') || 
    paymentMethod.toLowerCase().includes('credit')
  );
  
  let subtotal, cardFee, finalTotal;
  
  if (isCardPayment) {
    // For card payments, calculate subtotal first, then add 5% fee
    // Formula: totalAmount = subtotal + (subtotal * 0.05)
    // Therefore: subtotal = totalAmount / 1.05
    subtotal = totalAmount / 1.05;
    cardFee = subtotal * 0.05;
    finalTotal = subtotal + cardFee;
  } else {
    // For non-card payments, no fee
    subtotal = totalAmount;
    cardFee = 0;
    finalTotal = totalAmount;
  }
  
  return {
    subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimal places
    cardFee: Math.round(cardFee * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
    isCardPayment: isCardPayment
  };
}

/**
 * Calculate discount amounts for promo codes
 * @param {number} originalAmount - Original amount before discount
 * @param {object} promoCode - Promo code object
 * @returns {object} - Discount calculation results
 */
function calculateDiscount(originalAmount, promoCode) {
  if (!promoCode) {
    return {
      originalAmount: originalAmount,
      discountAmount: 0,
      finalAmount: originalAmount
    };
  }
  
  let discountAmount = 0;
  
  if (promoCode.discounttype === "percentage") {
    discountAmount = (originalAmount * promoCode.discountvalue) / 100;
    if (promoCode.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, promoCode.maxDiscountAmount);
    }
  } else if (promoCode.discounttype === "fixed") {
    discountAmount = promoCode.discountvalue;
  }
  
  const finalAmount = Math.max(0, originalAmount - discountAmount);
  
  return {
    originalAmount: originalAmount,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalAmount: Math.round(finalAmount * 100) / 100
  };
}

/**
 * Get payment method display name
 * @param {string} paymentMethod - Technical payment method name
 * @returns {string} - User-friendly payment method name
 */
function getPaymentMethodDisplayName(paymentMethod) {
  if (!paymentMethod) return 'Unknown';
  
  const method = paymentMethod.toLowerCase();
  
  if (method === 'paynow_online' || method === 'paynow') {
    return 'Pay Now';
  } else if (method === 'credit_card' || method === 'card' || method.includes('card') || method.includes('credit')) {
    return 'Credit Card';
  } else {
    return 'Online Payment';
  }
}

/**
 * Calculate all payment details for display
 * @param {object} bookingData - Booking data object
 * @returns {object} - Complete payment calculation results
 */
function calculatePaymentDetails(bookingData) {
  const totalAmount = parseFloat(bookingData.totalAmount || 0);
  const originalAmount = parseFloat(bookingData.totalCost || totalAmount);
  const discountAmount = parseFloat(bookingData.discountAmount || 0);
  const paymentMethod = bookingData.paymentMethod || bookingData.paymentDetails?.paymentMethod;
  
  // Calculate discount if applicable
  const discount = discountAmount > 0 ? {
    originalAmount: originalAmount,
    discountAmount: discountAmount,
    finalAmount: originalAmount - discountAmount
  } : null;
  
  // For card payments with discounts, we need to calculate differently
  // The totalAmount already includes the card fee, so we need to work backwards
  const isCardPayment = paymentMethod && (
    paymentMethod.toLowerCase().includes('card') || 
    paymentMethod.toLowerCase().includes('credit')
  );
  
  let subtotal, cardFee, finalTotal;
  
  if (isCardPayment) {
    // For card payments, calculate subtotal first, then add 5% fee
    // Formula: totalAmount = subtotal + (subtotal * 0.05)
    // Therefore: subtotal = totalAmount / 1.05
    subtotal = totalAmount / 1.05;
    cardFee = subtotal * 0.05;
    finalTotal = subtotal + cardFee;
  } else {
    // For non-card payments, no fee
    subtotal = totalAmount;
    cardFee = 0;
    finalTotal = totalAmount;
  }
  
  return {
    originalAmount: originalAmount,
    discount: discount,
    subtotal: Math.round(subtotal * 100) / 100,
    cardFee: Math.round(cardFee * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
    paymentMethod: getPaymentMethodDisplayName(paymentMethod),
    isCardPayment: isCardPayment,
    promoCodeId: bookingData.promoCodeId,
    promoCodeName: bookingData.promoCodeName
  };
}

module.exports = {
  calculatePaymentAmounts,
  calculateDiscount,
  getPaymentMethodDisplayName,
  calculatePaymentDetails
};
