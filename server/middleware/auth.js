const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authLogger } = require('../utils/logger');
const { asyncHandler } = require('./errorHandler');

// Protect routes - verify JWT token
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if no token
  if (!token) {
    authLogger.warn('No token provided', { 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      path: req.originalUrl 
    });
    return res.status(401).json({
      success: false,
      message: 'No token, authorization denied'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      authLogger.warn('Token valid but user not found', { 
        userId: decoded.id,
        ip: req.ip 
      });
      return res.status(401).json({
        success: false,
        message: 'Token valid but user not found'
      });
    }

    if (!user.isActive) {
      authLogger.warn('Inactive user attempted access', { 
        userId: user._id,
        username: user.username,
        ip: req.ip 
      });
      return res.status(401).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    if (user.isLocked) {
      authLogger.warn('Locked user attempted access', { 
        userId: user._id,
        username: user.username,
        lockUntil: user.lockUntil,
        ip: req.ip 
      });
      return res.status(401).json({
        success: false,
        message: 'User account is temporarily locked'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    authLogger.error('Token verification failed', { 
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent') 
    });
    
    return res.status(401).json({
      success: false,
      message: 'Token is not valid'
    });
  }
});

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      authLogger.warn('Insufficient permissions', {
        userId: req.user._id,
        username: req.user.username,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.originalUrl,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

// Check specific permissions
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!req.user.hasPermission(resource, action)) {
      authLogger.warn('Permission denied', {
        userId: req.user._id,
        username: req.user.username,
        resource,
        action,
        path: req.originalUrl,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required: ${action} on ${resource}`
      });
    }

    next();
  };
};

// Rate limiting for sensitive operations
const sensitiveRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user._id : '');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old attempts
    if (attempts.has(key)) {
      const userAttempts = attempts.get(key).filter(time => time > windowStart);
      attempts.set(key, userAttempts);
    }

    const currentAttempts = attempts.get(key) || [];

    if (currentAttempts.length >= maxAttempts) {
      authLogger.warn('Rate limit exceeded for sensitive operation', {
        ip: req.ip,
        userId: req.user ? req.user._id : null,
        path: req.originalUrl,
        attempts: currentAttempts.length
      });

      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil((currentAttempts[0] + windowMs - now) / 1000)
      });
    }

    // Record this attempt
    currentAttempts.push(now);
    attempts.set(key, currentAttempts);

    next();
  };
};

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h',
    issuer: 'hbus-credit-manager',
    audience: 'hbus-users'
  });
};

// Verify refresh token
const verifyRefreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// Optional authentication (doesn't fail if no token)
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive && !user.isLocked) {
        req.user = user;
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }
  }

  next();
});

module.exports = {
  protect,
  authorize,
  checkPermission,
  sensitiveRateLimit,
  generateToken,
  verifyRefreshToken,
  optionalAuth
};