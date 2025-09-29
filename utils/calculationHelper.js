/**
 * Calculate card processing fee and amounts
 * @param {number} totalAmount 
 * @param {string} paymentMethod
 * @returns {object}
 */
function calculatePaymentAmounts(totalAmount, paymentMethod) {
  const isCardPayment = paymentMethod && (
    paymentMethod.toLowerCase().includes('card') || 
    paymentMethod.toLowerCase().includes('credit')
  );
  
  let subtotal, cardFee, finalTotal;
  
  if (isCardPayment) {
    subtotal = totalAmount / 1.05;
    cardFee = subtotal * 0.05;
    finalTotal = subtotal + cardFee;
  } else {
    subtotal = totalAmount;
    cardFee = 0;
    finalTotal = totalAmount;
  }
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    cardFee: Math.round(cardFee * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
    isCardPayment: isCardPayment
  };
}

/**
 * @param {number} originalAmount 
 * @param {object} promoCode 
 * @returns {object} 
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
 * @param {string} paymentMethod 
 * @returns {string} 
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
 * @param {object} bookingData 
 * @returns {object} 
 */
function calculatePaymentDetails(bookingData) {
  const totalAmount = parseFloat(bookingData.totalAmount || 0);
  const originalAmount = parseFloat(bookingData.totalCost || totalAmount);
  const discountAmount = parseFloat(bookingData.discountAmount || 0);
  const packageDiscountAmount = parseFloat(bookingData.packageDiscountAmount || 0);
  const creditAmount = parseFloat(bookingData.creditAmount || 0);
  const paymentMethod = bookingData.paymentMethod || bookingData.paymentDetails?.paymentMethod;
  
  const discount = discountAmount > 0 ? {
    originalAmount: originalAmount,
    discountAmount: discountAmount,
    finalAmount: originalAmount - discountAmount
  } : null;
  

  const isCardPayment = paymentMethod && (
    paymentMethod.toLowerCase().includes('card') || 
    paymentMethod.toLowerCase().includes('credit')
  );
  
  let subtotal, cardFee, finalTotal;
  
  if (isCardPayment) {
    subtotal = totalAmount / 1.05;
    cardFee = subtotal * 0.05;
    finalTotal = subtotal + cardFee;
  } else {
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
    promoCodeName: bookingData.promoCodeName,
    packageDiscountAmount: packageDiscountAmount,
    packageName: bookingData.packageName,
    packageDiscountId: bookingData.packageDiscountId,
    creditAmount: creditAmount
  };
}

module.exports = {
  calculatePaymentAmounts,
  calculateDiscount,
  getPaymentMethodDisplayName,
  calculatePaymentDetails
};
