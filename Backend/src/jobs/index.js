const { startEnvironmentCron } = require('./environmentCron');
const { startReportCron } = require('./reportCron');
const { startSlaCron } = require('./slaCron');
const { startPriorityCron } = require('./priorityCron');
const { startEmbeddingCron } = require('./embeddingCron');

const JOBS = [
  ['environmentCron', startEnvironmentCron],
  ['reportCron', startReportCron],
  ['slaCron', startSlaCron],
  ['priorityCron', startPriorityCron],
  ['embeddingCron', startEmbeddingCron],
];

/**
 * Cờ chống chạy trùng. `startCrons` được gắn vào event 'connected' của Mongoose,
 * event này bắn lại sau MỖI lần reconnect — không có cờ thì mỗi lần đứt kết nối
 * lại nhân đôi số cron job đang chạy.
 */
let started = false;

/**
 * Khởi động toàn bộ cron job, idempotent.
 *
 * Lý do tồn tại hàm này: trước đây 5 lệnh start* nằm rải trong nhánh `.then()`
 * của `connectDB()` ở server.js, còn nhánh `.catch()` chỉ log rồi listen. Khi
 * MongoDB lỗi lúc boot (rất hay gặp với Atlas free tier ngủ đông đúng lúc deploy),
 * Mongoose tự reconnect ở tầng driver nên HTTP request hoạt động lại bình thường,
 * nhưng 5 cron job im lặng VĨNH VIỄN cho tới khi có người restart tiến trình.
 *
 * Từng job được bọc try/catch riêng: một job lỗi lúc đăng ký không được làm mất
 * các job còn lại.
 *
 * @returns {boolean} true nếu lượt gọi này thực sự khởi động, false nếu đã chạy trước đó
 */
const startCrons = () => {
  if (started) return false;
  started = true;

  for (const [name, start] of JOBS) {
    try {
      start();
    } catch (err) {
      console.error(`❌ Không khởi động được ${name}:`, err.message);
    }
  }
  return true;
};

module.exports = { startCrons };
