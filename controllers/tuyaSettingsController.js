const supabase = require('../config/database');

/**
 * Get all Tuya settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllTuyaSettings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('TuyaSettings')
      .select('*')
      .eq('isActive', true)
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching Tuya settings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch Tuya settings',
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error in getAllTuyaSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get a single Tuya setting by key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTuyaSetting = async (req, res) => {
  try {
    const { key } = req.params;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Setting key is required'
      });
    }

    const { data, error } = await supabase
      .from('TuyaSettings')
      .select('*')
      .eq('settingKey', key)
      .eq('isActive', true)
      .single();

    if (error || !data) {
      console.error('Error fetching Tuya setting:', error);
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
    console.error('Error in getTuyaSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update a Tuya setting
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateTuyaSetting = async (req, res) => {
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

    // Update the setting
    const { data, error } = await supabase
      .from('TuyaSettings')
      .update({
        settingValue: settingValue.toString(),
        updatedAt: new Date().toISOString()
      })
      .eq('settingKey', key)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating Tuya setting:', error);
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
    console.error('Error in updateTuyaSetting:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update multiple Tuya settings at once
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateMultipleTuyaSettings = async (req, res) => {
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
    }

    // Update all settings
    const updatePromises = settings.map(setting => 
      supabase
        .from('TuyaSettings')
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
    console.error('Error in updateMultipleTuyaSettings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Test Tuya connection with current settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const testTuyaConnection = async (req, res) => {
  try {
    const TuyaSmartLock = require('../utils/tuyaSmartLock');
    
    // Create a new instance which will read from database
    const smartLock = new TuyaSmartLock();
    
    // Try to get a token (this validates the credentials)
    await smartLock.getToken();

    if (smartLock.token) {
      res.json({
        success: true,
        message: 'Successfully connected to Tuya API',
        data: {
          tokenReceived: true,
          expiresAt: new Date(smartLock.tokenExpireTime).toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to Tuya API'
      });
    }
  } catch (error) {
    console.error('Error testing Tuya connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect to Tuya API',
      error: error.message
    });
  }
};

module.exports = {
  getAllTuyaSettings,
  getTuyaSetting,
  updateTuyaSetting,
  updateMultipleTuyaSettings,
  testTuyaConnection
};

