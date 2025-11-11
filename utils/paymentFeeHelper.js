const supabase = require('../config/database');

/**
 * Get payment settings from database
 * Falls back to default values if database read fails
 * @returns {Promise<Object>} Payment settings object
 */
async function getPaymentSettings() {
  try {
    const { data: settings, error } = await supabase
      .from('PaymentSettings')
      .select('*')
      .eq('isActive', true);

    if (error || !settings) {
      console.warn('⚠️ Could not load payment settings from database, using defaults');
      return getDefaultSettings();
    }

    // Convert array to object for easy lookup
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.settingKey] = parseFloat(setting.settingValue) || setting.settingValue;
    });

    return settingsMap;
  } catch (error) {
    console.error('❌ Error loading payment settings:', error);
    return getDefaultSettings();
  }
}

/**
 * Get default payment settings (fallback)
 * @returns {Object} Default settings object
 */
function getDefaultSettings() {
  return {
    PAYNOW_TRANSACTION_FEE: 0.20,
    CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE: 5.0,
    PAYNOW_ENABLED: true,
    CREDIT_CARD_ENABLED: true
  };
}

/**
 * Calculate PayNow transaction fee
 * @param {number} amount - Base amount
 * @returns {Promise<number>} Transaction fee
 */
async function calculatePayNowFee(amount) {
  try {
    const settings = await getPaymentSettings();
    const fee = settings.PAYNOW_TRANSACTION_FEE || 0.20;
    
    console.log(`💰 PayNow Fee Calculation: Base $${amount} + Fee $${fee} = Total $${(amount + fee).toFixed(2)}`);
    
    return fee;
  } catch (error) {
    console.error('Error calculating PayNow fee:', error);
    return 0.20; // Default fallback
  }
}

/**
 * Calculate Credit Card transaction fee
 * @param {number} amount - Base amount
 * @returns {Promise<number>} Transaction fee
 */
async function calculateCreditCardFee(amount) {
  try {
    const settings = await getPaymentSettings();
    const percentage = settings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
    const fee = (amount * percentage) / 100;
    
    console.log(`💳 Credit Card Fee Calculation: Base $${amount} × ${percentage}% = Fee $${fee.toFixed(2)}, Total $${(amount + fee).toFixed(2)}`);
    
    return fee;
  } catch (error) {
    console.error('Error calculating Credit Card fee:', error);
    return (amount * 5.0) / 100; // Default 5% fallback
  }
}

/**
 * Calculate total amount with transaction fee based on payment method
 * @param {number} baseAmount - Base amount before fees
 * @param {string} paymentMethod - Payment method: 'paynow' or 'credit_card'
 * @returns {Promise<Object>} Calculation result with fee breakdown
 */
async function calculateTotalWithFee(baseAmount, paymentMethod) {
  try {
    const amount = parseFloat(baseAmount);
    
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount');
    }

    let transactionFee = 0;
    let feeType = '';
    let details = '';

    if (paymentMethod.toLowerCase() === 'paynow') {
      transactionFee = await calculatePayNowFee(amount);
      feeType = 'fixed';
      details = `Fixed PayNow fee: SGD $${transactionFee.toFixed(2)}`;
    } else if (paymentMethod.toLowerCase() === 'credit_card') {
      transactionFee = await calculateCreditCardFee(amount);
      feeType = 'percentage';
      const settings = await getPaymentSettings();
      const percentage = settings.CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE || 5.0;
      details = `${percentage}% of SGD $${amount.toFixed(2)} = SGD $${transactionFee.toFixed(2)}`;
    } else {
      console.warn(`⚠️ Unknown payment method: ${paymentMethod}, no fee applied`);
    }

    const totalAmount = amount + transactionFee;

    return {
      baseAmount: amount,
      transactionFee: transactionFee,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      feeType: feeType,
      details: details
    };
  } catch (error) {
    console.error('Error calculating total with fee:', error);
    return {
      baseAmount: parseFloat(baseAmount),
      transactionFee: 0,
      totalAmount: parseFloat(baseAmount),
      paymentMethod: paymentMethod,
      feeType: 'none',
      details: 'Error calculating fee',
      error: error.message
    };
  }
}

/**
 * Check if payment method is enabled
 * @param {string} paymentMethod - Payment method: 'paynow' or 'credit_card'
 * @returns {Promise<boolean>} Whether the payment method is enabled
 */
async function isPaymentMethodEnabled(paymentMethod) {
  try {
    const settings = await getPaymentSettings();
    
    if (paymentMethod.toLowerCase() === 'paynow') {
      return settings.PAYNOW_ENABLED === true || settings.PAYNOW_ENABLED === 'true';
    } else if (paymentMethod.toLowerCase() === 'credit_card') {
      return settings.CREDIT_CARD_ENABLED === true || settings.CREDIT_CARD_ENABLED === 'true';
    }
    
    return true; // Default to enabled
  } catch (error) {
    console.error('Error checking payment method status:', error);
    return true; // Default to enabled if check fails
  }
}

module.exports = {
  getPaymentSettings,
  calculatePayNowFee,
  calculateCreditCardFee,
  calculateTotalWithFee,
  isPaymentMethodEnabled
};

/*
 * Usage Examples:
 * 
 * // In your payment controller:
 * const { calculateTotalWithFee, isPaymentMethodEnabled } = require('../utils/paymentFeeHelper');
 * 
 * // Calculate total for PayNow
 * const paynowTotal = await calculateTotalWithFee(50, 'paynow');
 * console.log(paynowTotal);
 * // {
 * //   baseAmount: 50,
 * //   transactionFee: 0.20,
 * //   totalAmount: 50.20,
 * //   paymentMethod: 'paynow',
 * //   feeType: 'fixed',
 * //   details: 'Fixed PayNow fee: SGD $0.20'
 * // }
 * 
 * // Calculate total for Credit Card
 * const creditCardTotal = await calculateTotalWithFee(50, 'credit_card');
 * console.log(creditCardTotal);
 * // {
 * //   baseAmount: 50,
 * //   transactionFee: 2.50,  // 5% of 50
 * //   totalAmount: 52.50,
 * //   paymentMethod: 'credit_card',
 * //   feeType: 'percentage',
 * //   details: '5% of SGD $50.00 = SGD $2.50'
 * // }
 * 
 * // Check if payment method is enabled
 * const paynowEnabled = await isPaymentMethodEnabled('paynow');
 * if (!paynowEnabled) {
 *   return res.status(400).json({ error: 'PayNow is currently disabled' });
 * }
 * 
 * // All fees are dynamically loaded from database!
 * // Admin can change them anytime from admin panel
 */

