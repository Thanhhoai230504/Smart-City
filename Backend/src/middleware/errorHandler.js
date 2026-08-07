const ApiError = require('../utils/apiError');

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns consistent JSON responses
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map(e => e.message);
    message = messages.join(', ');
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists.`;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired.';
  }

  // Lỗi không lường trước (không phải ApiError, không phải lỗi nghiệp vụ 4xx ở
  // trên) có thể mang chi tiết hạ tầng trong message — ví dụ host/replica set
  // MongoDB. Ở production chỉ trả message chung; message thật đã được
  // console.error ở đầu hàm nên vẫn tra được trong log server.
  if (process.env.NODE_ENV === 'production' && statusCode >= 500 && !(err instanceof ApiError)) {
    message = 'Internal Server Error';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(typeof err.code === 'string' && { code: err.code }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
