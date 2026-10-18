const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Department = require('../models/Department');

/**
 * Danh tính gắn vào `req.user`, đọc từ DB mỗi request để đổi vai trò, đơn vị có hiệu
 * lực ngay. Cán bộ của đơn vị đã bị vô hiệu hoá không còn phạm vi xử lý hợp lệ: trước
 * đây họ vẫn xem được SĐT, email người báo cáo và đổi trạng thái phiếu cũ của đơn vị.
 * Giờ họ được coi như người dùng thường trong request; staffMiddleware báo đúng lý do.
 */
const toRequestUser = async (user) => {
  const requestUser = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    // null với user/admin; là đơn vị của cán bộ với role 'staff'.
    departmentId: user.departmentId || null
  };
  if (user.role === 'staff' && user.departmentId) {
    const department = await Department.findById(user.departmentId).select('isActive').lean();
    if (!department || !department.isActive) {
      requestUser.role = 'user';
      requestUser.departmentId = null;
      requestUser.departmentInactive = true;
    }
  }
  return requestUser;
};

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
        message: 'Bạn cần đăng nhập để thực hiện thao tác này.'
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
        message: 'Tài khoản không tồn tại hoặc đã bị khoá.'
      });
    }

    req.user = await toRequestUser(user);

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn.',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập không hợp lệ.'
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
      message: 'Chỉ quản trị viên mới được thực hiện thao tác này.'
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
  if (req.user.departmentInactive) {
    return res.status(403).json({
      success: false,
      message: 'Đơn vị của bạn đã bị vô hiệu hoá. Liên hệ quản trị viên.',
      code: 'DEPARTMENT_INACTIVE'
    });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ cán bộ hoặc quản trị viên mới được thực hiện thao tác này.'
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
      req.user = await toRequestUser(user);
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
          message: 'Không tìm thấy dữ liệu.'
        });
      }

      // Check if the user is the owner
      if (resource.userId.toString() !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ được thao tác trên dữ liệu của chính mình.'
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
