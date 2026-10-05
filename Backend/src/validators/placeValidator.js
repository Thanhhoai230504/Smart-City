const { body } = require('express-validator');

const createPlaceValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Vui lòng nhập tên địa điểm'),
  body('type')
    .notEmpty().withMessage('Vui lòng chọn loại địa điểm')
    .isIn(['hospital', 'school', 'bus_stop', 'park', 'police'])
    .withMessage('Loại địa điểm không hợp lệ'),
  body('latitude')
    .notEmpty().withMessage('Thiếu vĩ độ của vị trí')
    .isFloat({ min: -90, max: 90 }).withMessage('Vĩ độ không hợp lệ'),
  body('longitude')
    .notEmpty().withMessage('Thiếu kinh độ của vị trí')
    .isFloat({ min: -180, max: 180 }).withMessage('Kinh độ không hợp lệ')
];

module.exports = { createPlaceValidator };
