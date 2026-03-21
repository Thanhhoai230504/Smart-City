const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT Access Token - Required for protected routes
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and attach to request
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated.'
      });
    }

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh your token.',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    next(error);
  }
};

/**
 * Admin-only middleware - Must be used AFTER authMiddleware
 */
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

/**
 * Owner middleware - User can only access their own resources
 * Uses the 'userId' field of the resource. Must be used AFTER authMiddleware.
 * For routes like /api/issues/:id where we need to check ownership.
 */
const ownerMiddleware = (model) => {
  return async (req, res, next) => {
    try {
      // Admins can access everything
      if (req.user.role === 'admin') {
        return next();
      }

      const resource = await model.findById(req.params.id);
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found.'
        });
      }

      // Check if the user is the owner
      if (resource.userId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only manage your own resources.'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { authMiddleware, adminMiddleware, ownerMiddleware };
