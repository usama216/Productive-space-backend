const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');
require('dotenv').config();

/**
 * Tuya Smart Lock utility functions
 * Based on Tuya IoT Platform API documentation
 * Manual implementation without @tuya/tuya-connector-nodejs dependency
 */

class TuyaSmartLock {
  constructor() {
    // Initialize with empty config - will be loaded from database
    this.config = {
      host: null,
      accessKey: null,
      secretKey: null
    };
    
    this.token = '';
    this.tokenExpireTime = 0; // Timestamp when token expires
    this.configLoaded = false; // Track if we've loaded config from DB
    
    // Create HTTP client with temporary baseURL (will be updated after loading config)
    this.httpClient = axios.create({
      baseURL: 'https://openapi.tuyaus.com', // Temporary default
      timeout: 5 * 1000,
    });
  }

  /**
   * Load Tuya configuration from database
   * @returns {Promise<void>}
   * @throws {Error} If required settings are missing from database
   */
  async loadConfigFromDatabase() {
    if (this.configLoaded) {
      return; // Already loaded
    }

    try {
      const supabase = require('../config/database');
      
      const { data: settings, error } = await supabase
        .from('TuyaSettings')
        .select('*')
        .eq('isActive', true);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      if (!settings || settings.length === 0) {
        throw new Error('No Tuya settings found in database. Please configure settings in admin panel.');
      }

      // Build config from database settings
      const settingsMap = {};
      settings.forEach(setting => {
        settingsMap[setting.settingKey] = setting.settingValue;
      });

      // Validate required settings
      const requiredSettings = ['TUYA_BASE_URL', 'TUYA_CLIENT_ID', 'TUYA_SECRET_KEY'];
      const missingSettings = requiredSettings.filter(key => !settingsMap[key]);
      
      if (missingSettings.length > 0) {
        throw new Error(`Missing required Tuya settings in database: ${missingSettings.join(', ')}. Please configure them in admin panel.`);
      }

      // Update config with database values
      this.config.host = settingsMap.TUYA_BASE_URL;
      this.config.accessKey = settingsMap.TUYA_CLIENT_ID;
      this.config.secretKey = settingsMap.TUYA_SECRET_KEY;

      // Update HTTP client baseURL
      this.httpClient.defaults.baseURL = this.config.host;

      console.log('✅ Tuya configuration loaded from database');
    } catch (error) {
      console.error('❌ Error loading Tuya config from database:', error.message);
      throw error; // Re-throw to prevent using invalid config
    } finally {
      this.configLoaded = true;
    }
  }

  /**
   * HMAC-SHA256 crypto function
   * @param {string} str - String to encrypt
   * @param {string} secret - Secret key
   * @returns {Promise<string>} Encrypted string
   */
  async encryptStr(str, secret) {
    return crypto.createHmac('sha256', secret).update(str, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * Check if current token is valid and not expired
   * @returns {boolean} True if token is valid, false otherwise
   */
  isTokenValid() {
    if (!this.token) {
      return false;
    }
    
    // Check if token is expired (with 5 minute buffer)
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return now < (this.tokenExpireTime - bufferTime);
  }

  /**
   * Fetch highway login token
   * @returns {Promise<void>}
   */
  async getToken() {
    // Load config from database first
    await this.loadConfigFromDatabase();

    const method = 'GET';
    const timestamp = Date.now().toString();
    const signUrl = '/v1.0/token?grant_type=1';
    const contentHash = crypto.createHash('sha256').update('').digest('hex');
    const stringToSign = [method, contentHash, '', signUrl].join('\n');
    const signStr = this.config.accessKey + timestamp + stringToSign;

    const headers = {
      t: timestamp,
      sign_method: 'HMAC-SHA256',
      client_id: this.config.accessKey,
      sign: await this.encryptStr(signStr, this.config.secretKey),
    };

    const { data: login } = await this.httpClient.get('/v1.0/token?grant_type=1', { headers });
    if (!login || !login.success) {
      throw new Error(`fetch failed: ${login.msg}`);
    }
    
    this.token = login.result.access_token;
    // Tuya tokens typically expire in 7200 seconds (2 hours)
    this.tokenExpireTime = Date.now() + (login.result.expire_time * 1000);
    
    // Log expiration time only, not the token itself (security: prevent token exposure)
    console.log('✅ Token refreshed successfully. Expires at:', new Date(this.tokenExpireTime));
  }

  /**
   * Ensure we have a valid token, refresh if needed
   * @returns {Promise<void>}
   */
  async ensureValidToken() {
    if (!this.isTokenValid()) {
      console.log('Token expired or invalid, refreshing...');
      await this.getToken();
    }
  }

  /**
   * Request sign, save headers 
   * @param {string} path - API path
   * @param {string} method - HTTP method
   * @param {Object} headers - Additional headers
   * @param {Object} query - Query parameters
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Signed headers
   */
  async getRequestSign(path, method, headers = {}, query = {}, body = {}) {
    const t = Date.now().toString();
    const [uri, pathQuery] = path.split('?');
    const queryMerged = Object.assign(query, qs.parse(pathQuery));
    const sortedQuery = {};
    Object.keys(queryMerged)
      .sort()
      .forEach((i) => (sortedQuery[i] = queryMerged[i]));

    const querystring = decodeURIComponent(qs.stringify(sortedQuery));
    const url = querystring ? `${uri}?${querystring}` : uri;
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const stringToSign = [method, contentHash, '', url].join('\n');
    const signStr = this.config.accessKey + this.token + t + stringToSign;
    
    return {
      t,
      path: url,
      client_id: this.config.accessKey,
      sign: await this.encryptStr(signStr, this.config.secretKey),
      sign_method: 'HMAC-SHA256',
      access_token: this.token,
    };
  }

  /**
   * Make API request with automatic token refresh on expiration
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} body - Request body
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} API response
   */
  async makeApiRequest(endpoint, method, body = {}, query = {}) {
    try {
      // Ensure we have a valid token
      await this.ensureValidToken();

      const reqHeaders = await this.getRequestSign(endpoint, method, {}, query, body);

      const { data } = await this.httpClient.request({
        method,
        data: body,
        params: query,
        headers: reqHeaders,
        url: reqHeaders.path,
      });

      return data;
    } catch (error) {
      // Check if error is due to token expiration
      if (error.response && error.response.data && 
          (error.response.data.code === 1010 || error.response.data.msg?.includes('token'))) {
        console.log('Token expired during API call, refreshing and retrying...');
        
        // Force token refresh
        this.token = '';
        this.tokenExpireTime = 0;
        await this.getToken();
        
        // Retry the request once
        const reqHeaders = await this.getRequestSign(endpoint, method, {}, query, body);
        const { data } = await this.httpClient.request({
          method,
          data: body,
          params: query,
          headers: reqHeaders,
          url: reqHeaders.path,
        });

        return data;
      }
      
      throw error;
    }
  }

  /**
   * Get Temporary Key for password encryption
   * Valid for 5 minutes
   * 
   * @param {string} deviceId - The device ID
   * @returns {Promise<Object>} Response containing ticket_id, ticket_key, and expire_time
   */
  async getTemporaryKey(deviceId) {
    try {
      const endpoint = `/v1.0/smart-lock/devices/${deviceId}/password-ticket`;
      const method = 'POST';
      const body = {};
      
      const data = await this.makeApiRequest(endpoint, method, body);

      // Log only success status, not full response data (security: prevent sensitive data exposure)
      if (data && data.success) {
        console.log('✅ Temporary key obtained successfully');
      } else {
        console.log('❌ Failed to get temporary key:', data?.msg || 'Unknown error');
      }
      
      if (data && data.success) {
        return {
          success: true,
          data: {
            ticketId: data.result.ticket_id,
            ticketKey: data.result.ticket_key,
            expireTime: data.result.expire_time
          }
        };
      } else {
        throw new Error(`Failed to get temporary key: ${data.msg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error getting temporary key:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unlock Door Without Password
   * Uses channel ID and valid temporary key
   * 
   * @param {string} deviceId - The device ID
   * @param {string} ticketId - The ID of the temporary key
   * @param {number} channelId - The channel ID (optional, defaults to 1)
   * @returns {Promise<Object>} Response indicating success/failure
   */
  async unlockDoorWithoutPassword(deviceId, ticketId, channelId = 1) {
    try {
      const endpoint = `/v1.1/devices/${deviceId}/door-lock/password-free/open-door`;
      const method = 'POST';
      const body = {
        ticket_id: ticketId,
        channel_id: channelId
      };

      const data = await this.makeApiRequest(endpoint, method, body);

      // Log only success status, not full response data (security: prevent sensitive data exposure)
      if (data && data.success) {
        console.log('✅ Door unlock request successful');
      } else {
        console.log('❌ Door unlock failed:', data?.msg || 'Unknown error');
      }

      if (data && data.success) {
        return {
          success: true,
          data: {
            result: data.result,
            unlocked: data.result === true
          }
        };
      } else {
        throw new Error(`Failed to unlock door: ${data.msg || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error unlocking door:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Complete unlock flow - gets temporary key and unlocks door
   * 
   * @param {string} deviceId - The device ID (optional, uses database/env var if not provided)
   * @param {number} channelId - The channel ID (optional, defaults to 1)
   * @returns {Promise<Object>} Response indicating success/failure
   */
  async unlockDoor(deviceId = null, channelId = 1) {
    try {
      // Load config from database first
      await this.loadConfigFromDatabase();

      // Get device ID from database
      let targetDeviceId = deviceId;
      if (!targetDeviceId) {
        const supabase = require('../config/database');
        const { data: lockIdSetting, error: lockIdError } = await supabase
          .from('TuyaSettings')
          .select('settingValue')
          .eq('settingKey', 'TUYA_SMART_LOCK_ID')
          .eq('isActive', true)
          .single();
        
        if (lockIdError || !lockIdSetting) {
          throw new Error('TUYA_SMART_LOCK_ID is not configured in database. Please configure it in admin settings.');
        }
        
        targetDeviceId = lockIdSetting.settingValue;
      }
      
      if (!targetDeviceId) {
        throw new Error('Device ID is required. Please configure TUYA_SMART_LOCK_ID in admin settings.');
      }

      // Step 1: Get temporary key
      const keyResponse = await this.getTemporaryKey(targetDeviceId);
      if (!keyResponse.success) {
        return keyResponse;
      }

      // Step 2: Unlock door using the temporary key
      const unlockResponse = await this.unlockDoorWithoutPassword(
        targetDeviceId, 
        keyResponse.data.ticketId, 
        channelId
      );

      return unlockResponse;
    } catch (error) {
      console.error('Error in unlock flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TuyaSmartLock;

/*
 * Configuration Setup:
 * 
 * All Tuya configuration is loaded from the TuyaSettings table in Supabase.
 * Required settings in the database:
 * 
 * - TUYA_CLIENT_ID: Tuya API Access Key / Client ID
 * - TUYA_SECRET_KEY: Tuya API Secret Key
 * - TUYA_BASE_URL: Tuya API Base URL (e.g., https://openapi-sg.iotbing.com)
 * - TUYA_SMART_LOCK_ID: Tuya Smart Lock Device ID
 * - MAX_ACCESS_COUNT: Maximum door access attempts per booking (-1 for unlimited)
 * 
 * All settings must have isActive = true to be used.
 * 
 * Usage Examples:
 * 
 * // Configuration is automatically loaded from database
 * const smartLock = new TuyaSmartLock();
 * 
 * // Unlock door using device ID from database
 * const result = await smartLock.unlockDoor();
 * 
 * // Unlock door with specific device ID
 * const result = await smartLock.unlockDoor('your_device_id');
 * 
 * // Unlock door with specific device ID and channel
 * const result = await smartLock.unlockDoor('your_device_id', 2);
 * 
 * Token Management Features:
 * - Automatic token refresh when expired (with 5-minute buffer)
 * - Automatic retry on token expiration errors
 * - Token expiration tracking and validation
 * - Seamless operation without manual token management
 * - Configuration loaded from database on first use
 * 
 * Dependencies:
 * - axios: HTTP client for API requests
 * - crypto: Built-in Node.js crypto module for HMAC-SHA256
 * - qs: Query string parsing library
 * - supabase: Database client for loading configuration
 */
