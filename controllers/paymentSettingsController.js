const supabase = require('../config/database');

/**
 * Get all payment settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllPaymentSettings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('PaymentSettings')
      .select('*')
      .eq('isActive', true)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching payment settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch payment settings',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error in getAllPaymentSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get a single payment setting by key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getPaymentSetting = async (req, res) => {
  try {
    const { key } = req.params;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Setting key is required'
      });
    }

    const { data, error } = await supabase
      .from('PaymentSettings')
      .select('*')
      .eq('settingKey', key)
      .eq('isActive', true)
      .single();

    if (error || !data) {
      console.error('Error fetching payment setting:', error);
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error in getPaymentSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update a payment setting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updatePaymentSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { settingValue } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Setting key is required'
      });
    }

    if (settingValue === undefined || settingValue === null) {
      return res.status(400).json({
        success: false,
        message: 'Setting value is required'
      });
    }

    // Validate numeric values for fee settings
    if (key.includes('FEE') || key.includes('AMOUNT')) {
      const numValue = parseFloat(settingValue);
      if (isNaN(numValue) || numValue < 0) {
        return res.status(400).json({
          success: false,
          message: 'Fee/amount values must be valid positive numbers'
        });
      }
    }

    // Update the setting
    const { data, error } = await supabase
      .from('PaymentSettings')
      .update({
        settingValue: settingValue.toString(),
        updatedAt: new Date().toISOString()
      })
      .eq('settingKey', key)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating payment setting:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update setting',
        error: error.message
      });
    }

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: data
    });
  } catch (error) {
    console.error('Error in updatePaymentSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update multiple payment settings at once
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateMultiplePaymentSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Settings array is required and must not be empty'
      });
    }

    // Validate all settings before updating
    for (const setting of settings) {
      if (!setting.settingKey || setting.settingValue === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Each setting must have settingKey and settingValue'
        });
      }

      // Validate numeric values
      if (setting.settingKey.includes('FEE') || setting.settingKey.includes('AMOUNT')) {
        const numValue = parseFloat(setting.settingValue);
        if (isNaN(numValue) || numValue < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${setting.settingKey}: must be a positive number`
          });
        }
      }
    }

    // Update all settings
    const updatePromises = settings.map(setting => 
      supabase
        .from('PaymentSettings')
        .update({
          settingValue: setting.settingValue.toString(),
          updatedAt: new Date().toISOString()
        })
        .eq('settingKey', setting.settingKey)
        .select('*')
        .single()
    );

    const results = await Promise.all(updatePromises);

    // Check for any errors
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Error updating some settings:', errors);
      return res.status(500).json({
        success: false,
        message: 'Failed to update some settings',
        errors: errors.map(e => e.error.message)
      });
    }

    res.json({
      success: true,
      message: 'All settings updated successfully',
      data: results.map(r => r.data)
    });
  } catch (error) {
    console.error('Error in updateMultiplePaymentSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Calculate transaction fees based on current settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const calculateTransactionFee = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    if (!paymentMethod || !['paynow', 'credit_card'].includes(paymentMethod.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Payment method must be either "paynow" or "credit_card"'
      });
    }

    // Get current fee settings
    const { data: settings, error } = await supabase
      .from('PaymentSettings')
      .select('*')
      .eq('isActive', true)
      .in('settingKey', ['PAYNOW_TRANSACTION_FEE', 'CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE']);

    if (error || !settings) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch fee settings'
      });
    }

    let transactionFee = 0;
    let feeType = '';
    let calculationDetails = '';

    if (paymentMethod.toLowerCase() === 'paynow') {
      const paynowSetting = settings.find(s => s.settingKey === 'PAYNOW_TRANSACTION_FEE');
      if (paynowSetting) {
        transactionFee = parseFloat(paynowSetting.settingValue);
        feeType = 'fixed';
        calculationDetails = `Fixed fee of SGD $${transactionFee.toFixed(2)}`;
      }
    } else if (paymentMethod.toLowerCase() === 'credit_card') {
      const creditCardSetting = settings.find(s => s.settingKey === 'CREDIT_CARD_TRANSACTION_FEE_PERCENTAGE');
      if (creditCardSetting) {
        const percentage = parseFloat(creditCardSetting.settingValue);
        transactionFee = (amount * percentage) / 100;
        feeType = 'percentage';
        calculationDetails = `${percentage}% of SGD $${amount.toFixed(2)} = SGD $${transactionFee.toFixed(2)}`;
      }
    }

    const totalAmount = parseFloat(amount) + transactionFee;

    res.json({
      success: true,
      data: {
        baseAmount: parseFloat(amount),
        transactionFee: transactionFee,
        totalAmount: totalAmount,
        paymentMethod: paymentMethod,
        feeType: feeType,
        calculationDetails: calculationDetails
      }
    });
  } catch (error) {
    console.error('Error in calculateTransactionFee:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getAllPaymentSettings,
  getPaymentSetting,
  updatePaymentSetting,
  updateMultiplePaymentSettings,
  calculateTransactionFee
};

