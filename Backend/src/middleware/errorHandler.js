const ApiError = require('../utils/apiError');
const { logger } = require('../utils/logger');

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns consistent JSON responses
 */
const errorHandler = (err, req, res, next) => {
  // Trước đây chỉ log `err.message`, KHÔNG log stack — trong khi ở production
  // message của lỗi 5xx lại bị thay bằng 'Lỗi máy chủ. Vui lòng thử lại sau.' phía dưới. Kết
  // quả là lỗi nghiêm trọng nhất lại là lỗi khó truy nhất.
  // Lỗi nghiệp vụ 4xx là chuyện bình thường nên chỉ ghi mức warn, không kèm stack.
  const statusForLog = err.statusCode || 500;
  const context = {
    method: req?.method,
    path: req?.originalUrl,
    userId: req?.user?.id ? String(req.user.id) : undefined,
    status: statusForLog,
    code: typeof err.code === 'string' ? err.code : undefined,
  };

  if (statusForLog >= 500) {
    logger.error(err.message, { ...context, stack: err.stack });
  } else {
    logger.warn(err.message, context);
  }
  
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ. Vui lòng thử lại sau.';
  // Lỗi theo từng field, cùng shape với middleware/validate.js. Trước đây
  // ValidationError của Mongoose bị gộp thành MỘT chuỗi nên client không biết lỗi
  // thuộc field nào để hiển thị inline — app mobile cần điều đó.
  let fieldErrors = null;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // err.errors được key theo path; lỗi Mongoose thật còn có e.path, nhưng lỗi
    // dựng tay trong test thì không nên fallback về key.
    fieldErrors = Object.entries(err.errors).map(([field, e]) => ({
      field: e.path || field,
      message: e.message,
    }));
    // Vẫn giữ message gộp để không phá client đang đọc trường message.
    message = fieldErrors.map(e => e.message).join(', ');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Giá trị của trường ${field} đã tồn tại.`;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Giá trị không hợp lệ cho trường ${err.path}.`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Phiên đăng nhập không hợp lệ.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Phiên đăng nhập đã hết hạn.';
  }

  // Lỗi không lường trước (không phải ApiError, không phải lỗi nghiệp vụ 4xx ở
  // trên) có thể mang chi tiết hạ tầng trong message — ví dụ host/replica set
  // MongoDB. Ở production chỉ trả message chung; message thật đã được
  // console.error ở đầu hàm nên vẫn tra được trong log server.
  if (process.env.NODE_ENV === 'production' && statusCode >= 500 && !(err instanceof ApiError)) {
    message = 'Lỗi máy chủ. Vui lòng thử lại sau.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Cùng shape với middleware/validate.js: [{ field, message }].
    ...(fieldErrors && { errors: fieldErrors }),
    ...(typeof err.code === 'string' && { code: err.code }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
