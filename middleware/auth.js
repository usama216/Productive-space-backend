const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/database');


const authenticateUser = async (req, res, next) => {
  try {
  
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header. Please provide a valid Bearer token.'
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication token is required'
      });
    }

  
    // Use SUPABASE_ANON_KEY if available, otherwise fallback to SUPABASE_KEY
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    
    if (!supabaseAnonKey) {
      console.error('SUPABASE_ANON_KEY or SUPABASE_KEY is not set in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'Authentication service is not properly configured'
      });
    }

    if (!process.env.SUPABASE_URL) {
      console.error('SUPABASE_URL is not set in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error',
        message: 'Authentication service is not properly configured'
      });
    }

    const supabaseAnon = createClient(
      process.env.SUPABASE_URL,
      supabaseAnonKey
    );

    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }


    const { data: userProfile, error: profileError } = await supabase
      .from('User')
      .select('id, email, memberType')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User profile not found'
      });
    }

 
    req.user = {
      id: user.id,
      email: user.email,
      memberType: userProfile.memberType
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'User authentication required'
    });
  }

  if (req.user.memberType !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required. You do not have permission to access this resource.'
    });
  }

  next();
};

module.exports = {
  authenticateUser,
  requireAdmin
};

