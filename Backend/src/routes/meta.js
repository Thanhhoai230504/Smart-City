const express = require('express');
const { buildMeta, META_VERSION } = require('../utils/metaConfig');

const router = express.Router();

/**
 * Taxonomy cho client — công khai, không cần đăng nhập.
 *
 * App mobile gọi endpoint này lúc khởi động và cache lại theo `version`. Lý do nó
 * phải nằm ở server: app đã cài trên máy người dùng thì không cập nhật được danh
 * mục/nhãn/ngưỡng nếu không qua store, trong khi web chỉ cần deploy.
 *
 * Payload tĩnh (dựng từ các file config, không truy vấn DB) nên cache dài được.
 * @route GET /api/meta/enums
 */
router.get('/enums', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, data: buildMeta() });
});

/** Chỉ trả version để client kiểm tra có cần tải lại payload đầy đủ không. */
// @route GET /api/meta/version
router.get('/version', (req, res) => {
  res.json({ success: true, data: { version: META_VERSION } });
});

module.exports = router;
