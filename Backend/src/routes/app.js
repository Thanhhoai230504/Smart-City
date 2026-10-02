const express = require('express');
const { buildAppConfig } = require('../utils/appConfig');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * Phiên bản app mobile còn được hỗ trợ (task 0.8). Công khai — app gọi lúc khởi
 * động, kể cả trước khi đăng nhập.
 *
 * Ghi log `X-App-Version` ở đây (một lần mỗi lần mở app) thay vì ở mọi request:
 * đủ để biết còn bao nhiêu máy chạy bản cũ trước khi nâng ngưỡng, mà không làm
 * ngập log.
 * @route GET /api/app/config
 */
router.get('/config', (req, res) => {
  const config = buildAppConfig(req.get('X-App-Version'));
  logger.info('Phiên bản app mobile', {
    event: 'app_version_seen',
    appVersion: config.clientVersion,
    forceUpdate: config.forceUpdate,
    userAgent: (req.get('User-Agent') || '').slice(0, 120),
  });
  // Ngắn: nâng ngưỡng là chuyện khẩn (lỗ hổng ở bản cũ) nên phải có hiệu lực nhanh.
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ success: true, data: config });
});

module.exports = router;
