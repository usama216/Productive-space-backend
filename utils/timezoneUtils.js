// Timezone utility functions for Singapore time (GMT+8)
let moment;
try {
  moment = require('moment-timezone');
} catch (error) {
  // console.error(' moment-timezone not installed:', error.message);
  // Fallback to native Date methods
  moment = null;
}

/**
 * Convert UTC time to Singapore time
 * @param {string|Date} utcTime - UTC time string or Date object
 * @returns {Date} - Singapore time as Date object
 */
const toSingaporeTime = (utcTime) => {
  if (!utcTime) return null;
  
  // Ensure the time has 'Z' suffix if it's a string
  let timeString = utcTime;
  if (typeof utcTime === 'string' && !utcTime.endsWith('Z') && !utcTime.includes('+')) {
    timeString = utcTime + 'Z';
  }
  
  // Convert to Singapore time
  if (moment) {
    return moment(timeString).tz('Asia/Singapore').toDate();
  } else {
    // Fallback to native Date methods
    const date = new Date(timeString);
    // Singapore is UTC+8
    const singaporeTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));
    return singaporeTime;
  }
};

/**
 * Format date in Singapore timezone
 * @param {string|Date} utcTime - UTC time string or Date object
 * @param {string} format - Date format (default: 'en-SG')
 * @returns {string} - Formatted date string
 */
const formatSingaporeDate = (utcTime, format = 'en-SG') => {
  if (!utcTime) return 'N/A';
  
  const singaporeTime = toSingaporeTime(utcTime);
  return singaporeTime.toLocaleDateString(format, { 
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format time in Singapore timezone
 * @param {string|Date} utcTime - UTC time string or Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted time string
 */
const formatSingaporeTime = (utcTime, options = {}) => {
  if (!utcTime) return 'N/A';
  
  const singaporeTime = toSingaporeTime(utcTime);
  const defaultOptions = {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  };
  
  return singaporeTime.toLocaleTimeString('en-SG', { ...defaultOptions, ...options });
};

/**
 * Format date and time in Singapore timezone
 * @param {string|Date} utcTime - UTC time string or Date object
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date and time string
 */
const formatSingaporeDateTime = (utcTime, options = {}) => {
  try {
    if (!utcTime) return 'N/A';
    
    console.log('🌏 [DEBUG] formatSingaporeDateTime input:', utcTime);
    const singaporeTime = toSingaporeTime(utcTime);
    console.log('🌏 [DEBUG] Singapore time converted:', singaporeTime);
    
    const defaultOptions = {
      timeZone: 'Asia/Singapore',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      weekday: 'long'
    };
    
    const result = singaporeTime.toLocaleString('en-SG', { ...defaultOptions, ...options });
    console.log('🌏 [DEBUG] Formatted result:', result);
    return result;
  } catch (error) {
    console.error('🌏 [DEBUG] formatSingaporeDateTime error:', error.message);
    return 'N/A';
  }
};

/**
 * Format date and time for invoice PDFs
 * @param {string|Date} utcTime - UTC time string or Date object
 * @returns {object} - Object with formatted date and time
 */
const formatForInvoice = (utcTime) => {
  if (!utcTime) return { date: 'N/A', time: 'N/A' };
  
  const singaporeTime = toSingaporeTime(utcTime);
  
  return {
    date: singaporeTime.toLocaleDateString('en-SG', {
      timeZone: 'Asia/Singapore',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }),
    time: singaporeTime.toLocaleTimeString('en-SG', {
      timeZone: 'Asia/Singapore',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  };
};

/**
 * Get current Singapore time
 * @returns {Date} - Current Singapore time
 */
const getCurrentSingaporeTime = () => {
  if (moment) {
    return moment().tz('Asia/Singapore').toDate();
  } else {
    // Fallback to native Date methods
    const now = new Date();
    return new Date(now.getTime() + (8 * 60 * 60 * 1000));
  }
};

/**
 * Format current Singapore time for display
 * @returns {object} - Object with current date and time
 */
const getCurrentSingaporeDateTime = () => {
  try {
    console.log('🌏 [DEBUG] Getting current Singapore date time...');
    const now = getCurrentSingaporeTime();
    console.log('🌏 [DEBUG] Current Singapore time:', now);
    
    const result = {
      date: now.toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore' }),
      time: now.toLocaleTimeString('en-SG', { 
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    
    console.log('🌏 [DEBUG] Formatted current time:', result);
    return result;
  } catch (error) {
    console.error('🌏 [DEBUG] getCurrentSingaporeDateTime error:', error.message);
    return {
      date: 'N/A',
      time: 'N/A'
    };
  }
};

module.exports = {
  toSingaporeTime,
  formatSingaporeDate,
  formatSingaporeTime,
  formatSingaporeDateTime,
  formatForInvoice,
  getCurrentSingaporeTime,
  getCurrentSingaporeDateTime
};
