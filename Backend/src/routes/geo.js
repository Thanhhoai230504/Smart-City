const express = require('express');
const { query, param } = require('express-validator');
const validate = require('../middleware/validate');
const { geoLimiter, geoTileLimiter } = require('../middleware/rateLimiters');
const {
  autocomplete,
  placeDetail,
  reverseGeocode,
  route,
  trafficTile,
} = require('../controllers/geoController');

const router = express.Router();

/**
 * Proxy Goong/TomTom để API key không rời khỏi server — xem services/geoService.js.
 *
 * Công khai có chủ đích: màn báo cáo sự cố và bản đồ đều cho khách chưa đăng nhập
 * dùng. Chặn lạm dụng bằng rate limit + cache chứ không bằng xác thực, vì bắt
 * đăng nhập mới tra được địa chỉ sẽ phá chính luồng mà hệ thống muốn khuyến khích.
 */

// @route GET /api/geo/autocomplete
router.get(
  '/autocomplete',
  geoLimiter,
  query('input').trim().isLength({ min: 1, max: 200 }).withMessage('input từ 1 đến 200 ký tự'),
  query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat không hợp lệ'),
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng không hợp lệ'),
  query('radius').optional().isInt({ min: 1, max: 200 }).withMessage('radius từ 1 đến 200 km'),
  query('limit').optional().isInt({ min: 1, max: 10 }).withMessage('limit từ 1 đến 10'),
  validate,
  autocomplete
);

// @route GET /api/geo/place-detail
router.get(
  '/place-detail',
  geoLimiter,
  query('place_id').trim().isLength({ min: 1, max: 300 }).withMessage('place_id là bắt buộc'),
  validate,
  placeDetail
);

// @route GET /api/geo/reverse
router.get(
  '/reverse',
  geoLimiter,
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat không hợp lệ'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('lng không hợp lệ'),
  validate,
  reverseGeocode
);

// @route GET /api/geo/route
router.get(
  '/route',
  geoLimiter,
  query('fromLat').isFloat({ min: -90, max: 90 }).withMessage('fromLat không hợp lệ'),
  query('fromLng').isFloat({ min: -180, max: 180 }).withMessage('fromLng không hợp lệ'),
  query('toLat').isFloat({ min: -90, max: 90 }).withMessage('toLat không hợp lệ'),
  query('toLng').isFloat({ min: -180, max: 180 }).withMessage('toLng không hợp lệ'),
  validate,
  route
);

// Tile có limiter riêng rộng hơn nhiều: một lượt kéo bản đồ sinh hàng chục tile,
// nên dùng chung ngưỡng với các route trên sẽ chặn nhầm người dùng bình thường.
// @route GET /api/geo/tiles/traffic/:z/:x/:y.png
router.get(
  '/tiles/traffic/:z/:x/:y.png',
  geoTileLimiter,
  param('z').isInt({ min: 0, max: 22 }).withMessage('z không hợp lệ'),
  param('x').isInt({ min: 0 }).withMessage('x không hợp lệ'),
  param('y').isInt({ min: 0 }).withMessage('y không hợp lệ'),
  validate,
  trafficTile
);

module.exports = router;
