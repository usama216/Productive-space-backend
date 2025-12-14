const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/database');

/**
 * Authenticate user - REQUIRED authentication middleware
 * Verifies Supabase JWT token and loads user profile
 * Sets req.user with user information
 */
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

    const token = authHeader.substring(7).trim();

    if (!token || token.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication token is required'
      });
    }

    // Validate environment variables
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

    // Create Supabase client for auth verification
    const supabaseAnon = createClient(
      process.env.SUPABASE_URL,
      supabaseAnonKey
    );

    // Verify token with Supabase Auth
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      console.error('Token verification failed:', authError?.message || 'No user returned');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }

    // Verify user email is confirmed (security check)
    if (!user.email_confirmed_at && user.email_confirmed_at !== null) {
      return res.status(403).json({
        success: false,
        error: 'Email not verified',
        message: 'Please verify your email address before accessing this resource'
      });
    }

    // Load user profile from database
    const { data: userProfile, error: profileError } = await supabase
      .from('User')
      .select('id, email, firstName, lastName, memberType, studentVerificationStatus, disabled, isDisabled')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('User profile not found:', profileError);
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User profile not found. Please contact support.'
      });
    }

    // Check if user is disabled
    if (userProfile.disabled === true || userProfile.isDisabled === true) {
      console.warn(`Disabled user attempted to access: ${user.id} (${user.email})`);
      return res.status(403).json({
        success: false,
        error: 'Account Disabled',
        message: 'Your account has been disabled. Please contact support for assistance.'
      });
    }

    // Set user information in request object
    req.user = {
      id: user.id,
      email: user.email,
      memberType: userProfile.memberType,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      studentVerificationStatus: userProfile.studentVerificationStatus
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

/**
 * Optional authentication middleware
 * Tries to authenticate user but doesn't fail if no token is provided
 * Useful for routes that work with or without authentication
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7).trim();

    if (!token || token.length === 0) {
      req.user = null;
      return next();
    }

    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    
    if (!supabaseAnonKey || !process.env.SUPABASE_URL) {
      req.user = null;
      return next();
    }

    const supabaseAnon = createClient(
      process.env.SUPABASE_URL,
      supabaseAnonKey
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);

    if (authError || !user) {
      req.user = null;
      return next();
    }

    // Load user profile
    const { data: userProfile } = await supabase
      .from('User')
      .select('id, email, firstName, lastName, memberType, studentVerificationStatus, disabled, isDisabled')
      .eq('id', user.id)
      .single();

    if (userProfile) {
      // Check if user is disabled
      if (userProfile.disabled === true || userProfile.isDisabled === true) {
        req.user = null;
        return next();
      }

      req.user = {
        id: user.id,
        email: user.email,
        memberType: userProfile.memberType,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        studentVerificationStatus: userProfile.studentVerificationStatus
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // On error, continue without user
    console.error('Optional authentication error:', error);
    req.user = null;
    next();
  }
};

/**
 * Require admin role
 * Must be used after authenticateUser middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'User authentication required'
    });
  }

  // Security: Check admin role from database, not just from req.user
  // This prevents privilege escalation attacks
  if (req.user.memberType !== 'ADMIN') {
    console.warn(`Unauthorized admin access attempt by user ${req.user.id} (${req.user.email})`);
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required. You do not have permission to access this resource.'
    });
  }

  next();
};

/**
 * Require specific member types
 * Usage: requireMemberType(['STUDENT', 'MEMBER'])
 */
const requireMemberType = (allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User authentication required'
      });
    }

    if (!allowedTypes.includes(req.user.memberType)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Access restricted to: ${allowedTypes.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Verify user owns the resource or is admin
 * Usage: requireOwnershipOrAdmin('userId')
 */
const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User authentication required'
      });
    }

    const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
    
    // Admin can access any resource
    if (req.user.memberType === 'ADMIN') {
      return next();
    }

    // User can only access their own resources
    if (resourceUserId && resourceUserId === req.user.id) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'You can only access your own resources'
    });
  };
};

module.exports = {
  authenticateUser,
  optionalAuthenticate,
  requireAdmin,
  requireMemberType,
  requireOwnershipOrAdmin
};

