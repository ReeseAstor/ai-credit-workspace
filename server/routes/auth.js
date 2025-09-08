const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { authLogger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateToken, protect, sensitiveRateLimit, verifyRefreshToken } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public (Admin only in production)
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName, role, department } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email }, { username }]
  });

  if (existingUser) {
    authLogger.warn('Registration attempt with existing credentials', { 
      email, 
      username,
      ip: req.ip 
    });
    
    return res.status(400).json({
      success: false,
      message: 'User with this email or username already exists'
    });
  }

  // Validate required fields
  if (!username || !email || !password || !firstName || !lastName || !department) {
    return res.status(400).json({
      success: false,
      message: 'All required fields must be provided'
    });
  }

  // Create user with default permissions based on role
  const defaultPermissions = getDefaultPermissions(role || 'analyst');

  const user = await User.create({
    username,
    email,
    password,
    firstName,
    lastName,
    role: role || 'analyst',
    department,
    permissions: defaultPermissions
  });

  authLogger.info('New user registered', {
    userId: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    department: user.department,
    ip: req.ip
  });

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        permissions: user.permissions
      },
      token
    }
  });
}));

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  // Get user with password
  const user = await User.findOne({
    $or: [{ username }, { email: username }]
  }).select('+password');

  if (!user) {
    authLogger.warn('Login attempt with non-existent username', { 
      username,
      ip: req.ip 
    });
    
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Check if account is locked
  if (user.isLocked) {
    authLogger.warn('Login attempt on locked account', {
      userId: user._id,
      username: user.username,
      lockUntil: user.lockUntil,
      ip: req.ip
    });
    
    return res.status(401).json({
      success: false,
      message: 'Account is temporarily locked. Please try again later.',
      lockUntil: user.lockUntil
    });
  }

  // Check if account is active
  if (!user.isActive) {
    authLogger.warn('Login attempt on inactive account', {
      userId: user._id,
      username: user.username,
      ip: req.ip
    });
    
    return res.status(401).json({
      success: false,
      message: 'Account is inactive. Please contact administrator.'
    });
  }

  // Check password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    authLogger.warn('Failed login attempt', {
      userId: user._id,
      username: user.username,
      ip: req.ip,
      loginAttempts: user.loginAttempts + 1
    });

    // Increment login attempts
    await user.incLoginAttempts();

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  authLogger.info('Successful login', {
    userId: user._id,
    username: user.username,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
        lastLogin: user.lastLogin
      },
      token
    }
  });
}));

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        permissions: user.permissions,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      }
    }
  });
}));

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, sensitiveRateLimit(3), asyncHandler(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'email'];
  const updates = {};

  // Only allow specific fields to be updated
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields provided for update'
    });
  }

  // Check if email is being changed and if it already exists
  if (updates.email) {
    const existingUser = await User.findOne({ 
      email: updates.email, 
      _id: { $ne: req.user._id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email is already in use'
      });
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updates,
    { new: true, runValidators: true }
  );

  authLogger.info('User profile updated', {
    userId: user._id,
    username: user.username,
    updatedFields: Object.keys(updates),
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        department: user.department
      }
    }
  });
}));

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, sensitiveRateLimit(3), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required'
    });
  }

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    authLogger.warn('Failed password change attempt', {
      userId: user._id,
      username: user.username,
      ip: req.ip
    });
    
    return res.status(401).json({
      success: false,
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  authLogger.info('Password changed successfully', {
    userId: user._id,
    username: user.username,
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, asyncHandler(async (req, res) => {
  authLogger.info('User logged out', {
    userId: req.user._id,
    username: req.user.username,
    ip: req.ip
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
}));

// Helper function to get default permissions based on role
function getDefaultPermissions(role) {
  const permissionSets = {
    admin: [
      { resource: 'applications', actions: ['create', 'read', 'update', 'delete', 'approve'] },
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'reports', actions: ['create', 'read', 'update', 'delete'] },
      { resource: 'settings', actions: ['read', 'update'] }
    ],
    underwriter: [
      { resource: 'applications', actions: ['read', 'update', 'approve'] },
      { resource: 'reports', actions: ['read'] }
    ],
    analyst: [
      { resource: 'applications', actions: ['create', 'read', 'update'] },
      { resource: 'reports', actions: ['read'] }
    ],
    viewer: [
      { resource: 'applications', actions: ['read'] },
      { resource: 'reports', actions: ['read'] }
    ]
  };

  return permissionSets[role] || permissionSets.viewer;
}

module.exports = router;