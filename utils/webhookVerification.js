const crypto = require('crypto');

function verifyHitPayWebhook(req, salt) {
  try {
    if (!salt) {
      console.error('HitPay webhook salt is not configured');
      return false;
    }

    // HitPay sends webhook data as form-encoded (application/x-www-form-urlencoded)
    // Extract the payload - prefer rawBody for accurate signature verification
    let payload;
    
    // Try to get raw body first (for form-encoded data)
    if (req.rawBody) {
      // Parse raw body as form-encoded data
      const querystring = require('querystring');
      payload = querystring.parse(req.rawBody);
    } else if (req.body && Object.keys(req.body).length > 0) {
      // If body is already parsed (by urlencoded middleware), use it
      // But note: this is less secure as the body might have been modified
      payload = req.body;
      console.warn('Using parsed body instead of rawBody for webhook verification - rawBody should be captured');
    } else {
      console.error('No webhook payload found');
      return false;
    }

    // Extract the hmac value from the payload
    const receivedHmac = payload.hmac;
    
    if (!receivedHmac) {
      console.error('Missing hmac parameter in webhook payload');
      return false;
    }

    // Remove hmac from payload for signature calculation
    const { hmac, ...payloadWithoutHmac } = payload;

    // Sort all key-value pairs alphabetically by key
    const sortedKeys = Object.keys(payloadWithoutHmac).sort();

    // Build the query string: key1=value1&key2=value2...
    const queryString = sortedKeys
      .map(key => {
        const value = payloadWithoutHmac[key];
        // Encode key and value properly
        return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
      })
      .join('&');

    // Generate HMAC-SHA256 signature
    const computedHmac = crypto
      .createHmac('sha256', salt)
      .update(queryString)
      .digest('hex');

    // Normalize HMAC format - HitPay sends hex-encoded HMAC
    // Ensure both are hex strings for comparison
    const receivedHmacHex = receivedHmac.toLowerCase();
    const computedHmacHex = computedHmac.toLowerCase();

    // Use timing-safe comparison to prevent timing attacks
    // Both HMACs should be hex strings of equal length (64 chars for SHA256)
    if (receivedHmacHex.length !== computedHmacHex.length) {
      console.error('HMAC length mismatch:', {
        receivedLength: receivedHmacHex.length,
        computedLength: computedHmacHex.length
      });
      return false;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedHmacHex, 'hex'),
      Buffer.from(computedHmacHex, 'hex')
    );

    if (!isValid) {
      console.error('Invalid webhook signature:', {
        received: receivedHmacHex.substring(0, 20) + '...',
        computed: computedHmacHex.substring(0, 20) + '...',
        queryString: queryString.substring(0, 100) + '...'
      });
    }

    return isValid;
  } catch (error) {
    console.error('Webhook verification error:', error);
    return false;
  }
}


function verifyHitPayWebhookMiddleware(req, res, next) {
 
  const salt = process.env.HITPAY_WEBHOOK_SALT || process.env.HITPAY_SALT;

  if (!salt) {
    console.error('HITPAY_WEBHOOK_SALT environment variable is not set');
    return res.status(500).json({
      success: false,
      error: 'Webhook verification not configured'
    });
  }

  const isValid = verifyHitPayWebhook(req, salt);

  if (!isValid) {
    console.error('Webhook signature verification failed');
    return res.status(401).json({
      success: false,
      error: 'Invalid webhook signature',
      message: 'Request is not from HitPay or has been tampered with'
    });
  }

  // Parse the webhook body if not already parsed (for handler use)
  // Verification uses rawBody, but handlers expect req.body
  if (!req.body || Object.keys(req.body).length === 0) {
    if (req.rawBody) {
      const querystring = require('querystring');
      req.body = querystring.parse(req.rawBody);
    }
  }
  
  next();
}

module.exports = {
  verifyHitPayWebhook,
  verifyHitPayWebhookMiddleware
};

