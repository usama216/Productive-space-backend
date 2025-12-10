/**
 * Input Sanitization Utilities
 * Prevents SQL injection and XSS attacks by sanitizing user inputs
 */

/**
 * Sanitize string input for database queries
 * Removes or escapes potentially dangerous characters
 * @param {string} input - User input string
 * @param {number} maxLength - Maximum allowed length (default: 255)
 * @returns {string} Sanitized string
 */
function sanitizeString(input, maxLength = 255) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters
  let sanitized = input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove potentially dangerous SQL patterns
  // Note: Supabase uses PostgREST which has built-in protection,
  // but we still sanitize to be extra safe
  const dangerousPatterns = [
    /--/g,           // SQL comments
    /\/\*/g,         // SQL block comments
    /\*\//g,         // SQL block comments end
    /;/g,            // SQL statement separator
    /'/g,            // Single quotes (Supabase handles this, but we escape)
    /"/g,            // Double quotes
    /`/g,            // Backticks
    /\\/g,           // Backslashes
  ];

  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized;
}

/**
 * Sanitize search query input
 * More permissive than sanitizeString but still safe
 * @param {string} input - Search query string
 * @param {number} maxLength - Maximum allowed length (default: 100)
 * @returns {string} Sanitized search string
 */
function sanitizeSearchQuery(input, maxLength = 100) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters
  let sanitized = input
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove SQL injection patterns but allow common search characters
  const dangerousPatterns = [
    /--/g,           // SQL comments
    /\/\*/g,         // SQL block comments
    /\*\//g,         // SQL block comments end
    /;/g,            // SQL statement separator
    /'/g,            // Single quotes
    /"/g,            // Double quotes
    /`/g,            // Backticks
    /\\/g,           // Backslashes
  ];

  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized;
}

/**
 * Sanitize email input
 * @param {string} email - Email address
 * @returns {string} Sanitized email
 */
function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  // Basic email validation and sanitization
  const sanitized = email
    .toLowerCase()
    .trim()
    .replace(/[<>\"'`]/g, '') // Remove potentially dangerous characters
    .substring(0, 254); // Email max length

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitize UUID input
 * @param {string} uuid - UUID string
 * @returns {string} Sanitized UUID or empty string if invalid
 */
function sanitizeUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return '';
  }

  // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sanitized = uuid.trim();

  if (!uuidRegex.test(sanitized)) {
    return '';
  }

  return sanitized.toLowerCase();
}

/**
 * Sanitize numeric input
 * @param {any} input - Input value
 * @param {number} min - Minimum value (optional)
 * @param {number} max - Maximum value (optional)
 * @returns {number|null} Sanitized number or null if invalid
 */
function sanitizeNumber(input, min = null, max = null) {
  if (input === null || input === undefined) {
    return null;
  }

  const num = Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  if (min !== null && num < min) {
    return null;
  }

  if (max !== null && num > max) {
    return null;
  }

  return num;
}

/**
 * Validate and sanitize booking reference
 * @param {string} bookingRef - Booking reference
 * @returns {string} Sanitized booking reference
 */
function sanitizeBookingRef(bookingRef) {
  if (!bookingRef || typeof bookingRef !== 'string') {
    return '';
  }

  // Booking ref format: BOOK12345 or similar
  // Allow alphanumeric and common separators
  const sanitized = bookingRef
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '') // Only allow alphanumeric, underscore, hyphen
    .substring(0, 50); // Max length

  return sanitized;
}

/**
 * Escape special characters for Supabase PostgREST queries
 * While Supabase provides protection, this adds an extra layer
 * @param {string} input - Input string
 * @returns {string} Escaped string
 */
function escapePostgREST(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // PostgREST uses specific operators, escape them if they appear in user input
  // This is defensive programming - Supabase should handle this, but we're extra safe
  return input
    .replace(/'/g, "''")  // Escape single quotes
    .replace(/\\/g, '\\\\'); // Escape backslashes
}

module.exports = {
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeEmail,
  sanitizeUUID,
  sanitizeNumber,
  sanitizeBookingRef,
  escapePostgREST
};

