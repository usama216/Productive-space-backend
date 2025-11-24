const crypto = require('crypto');

function verifyHitPayWebhook(req, salt) {
  try {
   
    const signature = req.headers['hitpay-signature'] || req.headers['Hitpay-Signature'];
    
    if (!signature) {
      console.error('Missing Hitpay-Signature header');
      return false;
    }

    if (!salt) {
      console.error('HitPay webhook salt is not configured');
      return false;
    }

     let bodyString;
    if (req.rawBody) {
    
      bodyString = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : req.rawBody;
    } else if (typeof req.body === 'string') {
      bodyString = req.body;
    } else {
  
      bodyString = JSON.stringify(req.body);
    }

   
    const computedSignature = crypto
      .createHmac('sha256', salt)
      .update(bodyString)
      .digest('hex');

      const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );

    if (!isValid) {
      console.error('Invalid webhook signature:', {
        received: signature.substring(0, 20) + '...',
        computed: computedSignature.substring(0, 20) + '...'
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

 
  
  next();
}

module.exports = {
  verifyHitPayWebhook,
  verifyHitPayWebhookMiddleware
};

