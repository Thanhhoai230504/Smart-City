const mongoose = require('mongoose');
const { version } = require('../../package.json');

/**
 * Trạng thái kết nối MongoDB theo `mongoose.connection.readyState`.
 * 0/2/3 đều là "chưa sẵn sàng phục vụ": monitor cần thấy 503 chứ không phải 200.
 */
const DB_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * Tách thành hàm thuần để test được mọi nhánh trạng thái mà không phải giả lập
 * kết nối thật.
 */
const buildHealthPayload = (readyState, uptimeSeconds) => {
  const db = DB_STATES[readyState] || 'unknown';
  const success = readyState === 1;
  return {
    success,
    status: success ? 'ok' : 'degraded',
    db,
    uptimeSeconds: Math.round(uptimeSeconds),
    version,
  };
};

/**
 * GET /health
 *
 * Trước đây endpoint này không tồn tại: `GET /` trả 200 cứng và không đọc
 * readyState, nên monitor luôn báo xanh kể cả khi DB đã đứt. Kết hợp với việc
 * cron job chỉ khởi động trong nhánh .then() của connectDB(), hệ thống có thể
 * ở trạng thái "nửa sống" — API trả 200 nhưng SLA, điểm ưu tiên, dữ liệu môi
 * trường và embedding đều ngừng chạy — mà không có cách nào phát hiện.
 *
 * Đặt NGOÀI /api nên không chịu generalLimiter; monitor gõ mỗi vài giây cũng
 * không tự làm mình bị chặn.
 */
const getHealth = (req, res) => {
  const payload = buildHealthPayload(mongoose.connection.readyState, process.uptime());
  res.status(payload.success ? 200 : 503).json(payload);
};

module.exports = { getHealth, buildHealthPayload, DB_STATES };
