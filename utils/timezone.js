/**
 * Timezone utility functions for converting UTC to GMT+8 (Singapore/Malaysia timezone)
 */

/**
 * Convert UTC date to GMT+8 timezone
 * @param {string|Date} utcDate - UTC date string or Date object
 * @returns {Date} Date object in GMT+8 timezone
 */
const convertUTCToGMT8 = (utcDate) => {
  if (!utcDate) return null;
  
  try {
    const date = new Date(utcDate);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date provided to convertUTCToGMT8:', utcDate);
      return null;
    }
    
    // Convert to GMT+8 (UTC+8)
    const gmt8Offset = 8 * 60; // 8 hours in minutes
    const utcOffset = date.getTimezoneOffset(); // Get local timezone offset
    
    // Create new date with GMT+8 offset
    const gmt8Date = new Date(date.getTime() + (gmt8Offset + utcOffset) * 60000);
    
    return gmt8Date;
  } catch (error) {
    console.error('Error converting UTC to GMT+8:', error);
    return null;
  }
};

/**
 * Format date in GMT+8 timezone for display
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} format - Format type: 'date', 'time', 'datetime', 'full'
 * @returns {string} Formatted date string in GMT+8
 */
const formatGMT8Date = (utcDate, format = 'datetime') => {
  const gmt8Date = convertUTCToGMT8(utcDate);
  
  if (!gmt8Date) return 'N/A';
  
  try {
    switch (format) {
      case 'date':
        return gmt8Date.toLocaleDateString('en-SG', {
          timeZone: 'Asia/Singapore',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
      case 'time':
        return gmt8Date.toLocaleTimeString('en-SG', {
          timeZone: 'Asia/Singapore',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
      case 'datetime':
        return gmt8Date.toLocaleString('en-SG', {
          timeZone: 'Asia/Singapore',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
      case 'full':
        return gmt8Date.toLocaleString('en-SG', {
          timeZone: 'Asia/Singapore',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
      default:
        return gmt8Date.toLocaleString('en-SG', {
          timeZone: 'Asia/Singapore'
        });
    }
  } catch (error) {
    console.error('Error formatting GMT+8 date:', error);
    return 'N/A';
  }
};

/**
 * Get current date/time in GMT+8
 * @returns {Date} Current date in GMT+8
 */
const getCurrentGMT8 = () => {
  const now = new Date();
  return convertUTCToGMT8(now);
};

/**
 * Format current date/time in GMT+8
 * @param {string} format - Format type
 * @returns {string} Formatted current date/time in GMT+8
 */
const formatCurrentGMT8 = (format = 'datetime') => {
  return formatGMT8Date(new Date(), format);
};

module.exports = {
  convertUTCToGMT8,
  formatGMT8Date,
  getCurrentGMT8,
  formatCurrentGMT8
};
