const { getPaymentSettings } = require('./paymentFeeHelper');

/**
 * Calculate card processing fee and amounts (DYNAMIC VERSION)
 * @param {number} totalAmount 
 * @param {string} paymentMethod
 * @returns {Promise<object>}
 */
async function calculatePaymentAmounts(totalAmount, paymentMethod) {
  // Get dynamic settings from database
  const settings = await getPaymentSettings();
  const paynowFee = settings.PAYNOW_TRANSACTION_FEE || 0.20;
  const cardFeePercentage = settings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
  
  const isCardPayment = paymentMethod && (
    paymentMethod.toLowerCase().includes('card') || 
    paymentMethod.toLowerCase().includes('credit')
  );
  
  const isPayNowPayment = paymentMethod && (
    paymentMethod.toLowerCase().includes('paynow') || 
    paymentMethod.toLowerCase().includes('pay_now')
  );
  
  let subtotal, cardFee, payNowFeeFinal, finalTotal;
  
  if (isCardPayment) {
    // Card payment: totalAmount includes dynamic % fee
    const multiplier = 1 + (cardFeePercentage / 100);
    subtotal = totalAmount / multiplier;
    cardFee = subtotal * (cardFeePercentage / 100);
    payNowFeeFinal = 0;
    finalTotal = subtotal + cardFee;
  } else if (isPayNowPayment && totalAmount < 10) {
    // PayNow fee (dynamic from database) - ONLY for amounts < $10
    subtotal = totalAmount - paynowFee;
    cardFee = 0;
    payNowFeeFinal = paynowFee;
    finalTotal = totalAmount; // Already includes fee
  } else {
    subtotal = totalAmount;
    cardFee = 0;
    payNowFeeFinal = 0;
    finalTotal = totalAmount;
  }
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    cardFee: Math.round(cardFee * 100) / 100,
    payNowFee: Math.round(payNowFeeFinal * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
    isCardPayment: isCardPayment,
    isPayNowPayment: isPayNowPayment
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
 * @returns {Promise<object>} 
 */
async function calculatePaymentDetails(bookingData) {
  // Get dynamic settings from database
  const settings = await getPaymentSettings();
  const paynowFeeAmount = settings.PAYNOW_TRANSACTION_FEE || 0.20;
  const cardFeePercentage = settings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
  
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
  
  const isPayNowPayment = paymentMethod && (
    paymentMethod.toLowerCase().includes('paynow') || 
    paymentMethod.toLowerCase().includes('pay_now')
  );
  
  let subtotal, cardFee, payNowFee, finalTotal;
  
  if (isCardPayment) {
    // Card payment: totalAmount includes dynamic % fee
    const multiplier = 1 + (cardFeePercentage / 100);
    subtotal = totalAmount / multiplier;
    cardFee = subtotal * (cardFeePercentage / 100);
    payNowFee = 0;
    finalTotal = subtotal + cardFee;
  } else if (isPayNowPayment && totalAmount < 10) {
    // PayNow fee (dynamic from database) - ONLY for amounts < $10
    subtotal = totalAmount - paynowFeeAmount;
    cardFee = 0;
    payNowFee = paynowFeeAmount;
    finalTotal = totalAmount; // totalAmount already has the fee included
  } else {
    subtotal = totalAmount;
    cardFee = 0;
    payNowFee = 0;
    finalTotal = totalAmount;
  }
  
  return {
    originalAmount: originalAmount,
    discount: discount,
    subtotal: Math.round(subtotal * 100) / 100,
    cardFee: Math.round(cardFee * 100) / 100,
    payNowFee: Math.round(payNowFee * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100,
    paymentMethod: getPaymentMethodDisplayName(paymentMethod),
    isCardPayment: isCardPayment,
    isPayNowPayment: isPayNowPayment,
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
