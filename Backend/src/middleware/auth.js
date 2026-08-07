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
      role: user.role,
      // null với user/admin; là đơn vị của cán bộ với role 'staff'.
      // Lấy từ DB chứ không từ token để đổi đơn vị có hiệu lực ngay.
      departmentId: user.departmentId || null
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
 * Cho phép cả admin và cán bộ (staff) — dùng cho các route xử lý sự cố.
 * Việc giới hạn cán bộ chỉ thấy sự cố của đơn vị mình do service làm,
 * dựa trên `req.user.departmentId`. Phải dùng SAU authMiddleware.
 */
const staffMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff or admin privileges required.'
    });
  }
  // Cán bộ mất đơn vị (đơn vị bị xoá) thì không có phạm vi xử lý nào hợp lệ.
  if (req.user.role === 'staff' && !req.user.departmentId) {
    return res.status(403).json({
      success: false,
      message: 'Tài khoản cán bộ chưa được gán đơn vị. Liên hệ quản trị viên.'
    });
  }
  next();
};

/**
 * Xác thực tuỳ chọn: gắn `req.user` nếu có token hợp lệ, còn không thì cho đi
 * tiếp như khách. Dùng cho route công khai nhưng cần biết người gọi là ai —
 * ví dụ GET /api/issues phải bó phạm vi khi người gọi là cán bộ.
 * Token sai/hết hạn không trả 401 để không làm hỏng trải nghiệm khách xem công khai.
 */
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      req.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId || null
      };
    }
  } catch {
    // Token không hợp lệ thì coi như khách.
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

module.exports = {
  authMiddleware,
  adminMiddleware,
  staffMiddleware,
  optionalAuthMiddleware,
  ownerMiddleware
};
