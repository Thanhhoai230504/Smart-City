const { logger } = require('../utils/logger');

/** Không đóng xong trong khoảng này thì thoát cưỡng chế, tránh treo vĩnh viễn. */
const FORCE_EXIT_MS = 10_000;

/**
 * Đăng ký tắt có trật tự.
 *
 * Render gửi SIGTERM mỗi lần deploy. Không xử lý thì request đang chạy bị chặt
 * giữa chừng và cron đang chạy dở một batch bị đứt — người dùng thấy lỗi mạng
 * ngẫu nhiên mỗi lần deploy mà không rõ vì sao.
 *
 * Tách khỏi server.js để kiểm thử được: trên Windows không gửi được SIGTERM thật
 * (`Stop-Process` và `child.kill` đều terminate cứng, Node bỏ qua tham số signal),
 * nên hành vi này chỉ xác minh được bằng cách gọi thẳng hàm.
 *
 * @param {object} deps - server, io, mongoose, và process (tiêm vào để test)
 * @returns {{ shutdown: Function }}
 */
const registerShutdownHandlers = ({
  server,
  io,
  mongoose,
  proc = process,
  forceExitMs = FORCE_EXIT_MS,
} = {}) => {
  let shuttingDown = false;

  const shutdown = async (signal) => {
    // Nền tảng có thể gửi tín hiệu hai lần; lượt thứ hai không được làm hỏng
    // lượt đầu đang chạy dở.
    if (shuttingDown) return false;
    shuttingDown = true;
    logger.info('Nhận tín hiệu tắt, đang đóng kết nối', { signal });

    const forceTimer = setTimeout(() => {
      logger.error('Quá hạn tắt êm, thoát cưỡng chế', { timeoutMs: forceExitMs });
      proc.exit(1);
    }, forceExitMs);
    // Hẹn giờ này không được tự giữ tiến trình sống nếu mọi thứ đóng sớm.
    if (typeof forceTimer.unref === 'function') forceTimer.unref();

    try {
      // Thứ tự có chủ đích: ngừng nhận việc mới trước, rồi mới đóng DB — đóng DB
      // trước sẽ làm các request đang dở hỏng đúng cái mà graceful shutdown muốn tránh.
      if (io) io.close();
      if (server) await new Promise((resolve) => server.close(resolve));
      if (mongoose?.connection) await mongoose.connection.close(false);

      logger.info('Đã đóng xong, thoát');
      clearTimeout(forceTimer);
      proc.exit(0);
      return true;
    } catch (err) {
      logger.error('Lỗi khi tắt', { reason: err.message });
      clearTimeout(forceTimer);
      proc.exit(1);
      return false;
    }
  };

  proc.on('SIGTERM', () => shutdown('SIGTERM'));
  proc.on('SIGINT', () => shutdown('SIGINT'));

  // Promise bị reject mà không ai bắt sẽ làm Node thoát im lặng ở phiên bản mới.
  // Ghi lại để còn truy được, nhưng KHÔNG tắt — một promise hỏng ở nhánh phụ
  // không đáng làm sập cả hệ thống.
  proc.on('unhandledRejection', (reason) => {
    logger.error('Promise bị reject mà không được xử lý', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  // Ngược lại, uncaughtException để lại tiến trình ở trạng thái không xác định —
  // tắt có trật tự là lựa chọn an toàn hơn là chạy tiếp.
  proc.on('uncaughtException', (err) => {
    logger.error('Lỗi không bắt được — tiến trình sẽ tắt', {
      reason: err.message,
      stack: err.stack,
    });
    shutdown('uncaughtException');
  });

  return { shutdown };
};

module.exports = { registerShutdownHandlers, FORCE_EXIT_MS };
