const { validationResult } = require('express-validator');

/**
 * Middleware kiểm tra kết quả của các chuỗi express-validator — đặt sau chuỗi
 * validator trong route.
 *
 * `message` là câu tiếng Việt của lỗi đầu tiên. Trước đây nó là chuỗi cố định
 * "Validation failed" còn câu thật nằm trong `errors[]`; client nào chỉ đọc
 * `message` (web cũ ở nhiều chỗ) hiện nguyên chữ tiếng Anh cho người dùng.
 * `errors[]` (lỗi theo từng field) và `code` để client phân nhánh vẫn giữ.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fieldErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg
    }));
    return res.status(400).json({
      success: false,
      message: fieldErrors[0].message || 'Dữ liệu không hợp lệ.',
      code: 'VALIDATION_ERROR',
      errors: fieldErrors
    });
  }
  next();
};

module.exports = validate;
