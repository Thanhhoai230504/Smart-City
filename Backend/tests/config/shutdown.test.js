const { registerShutdownHandlers } = require('../../src/config/shutdown');
const { logger } = require('../../src/utils/logger');

/**
 * Trên Windows không gửi được SIGTERM thật (`Stop-Process` và `child.kill` đều
 * terminate cứng, Node bỏ qua tham số signal), nên hành vi tắt êm chỉ xác minh
 * được bằng cách gọi thẳng hàm — đó là lý do logic được tách khỏi server.js.
 */
const makeDeps = (overrides = {}) => {
  const handlers = {};
  return {
    handlers,
    deps: {
      server: { close: jest.fn((cb) => cb()) },
      io: { close: jest.fn() },
      mongoose: { connection: { close: jest.fn().mockResolvedValue() } },
      proc: {
        on: jest.fn((event, fn) => { handlers[event] = fn; }),
        exit: jest.fn(),
      },
      ...overrides,
    },
  };
};

describe('registerShutdownHandlers', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it.each(['SIGTERM', 'SIGINT', 'unhandledRejection', 'uncaughtException'])(
    'registers a handler for %s',
    (event) => {
      const { handlers, deps } = makeDeps();
      registerShutdownHandlers(deps);
      expect(typeof handlers[event]).toBe('function');
    }
  );

  it('closes sockets, the HTTP server and the database, then exits cleanly', async () => {
    const { deps } = makeDeps();
    const { shutdown } = registerShutdownHandlers(deps);

    await shutdown('SIGTERM');

    expect(deps.io.close).toHaveBeenCalled();
    expect(deps.server.close).toHaveBeenCalled();
    expect(deps.mongoose.connection.close).toHaveBeenCalledWith(false);
    expect(deps.proc.exit).toHaveBeenCalledWith(0);
  });

  // Đóng DB trước sẽ làm các request đang dở hỏng — đúng cái mà graceful
  // shutdown muốn tránh.
  it('stops accepting work before closing the database', async () => {
    const order = [];
    const { deps } = makeDeps({
      server: { close: jest.fn((cb) => { order.push('server'); cb(); }) },
      mongoose: { connection: { close: jest.fn(async () => { order.push('db'); }) } },
    });
    const { shutdown } = registerShutdownHandlers(deps);

    await shutdown('SIGTERM');

    expect(order).toEqual(['server', 'db']);
  });

  // Nền tảng có thể gửi tín hiệu hai lần.
  it('ignores a second signal while already shutting down', async () => {
    const { deps } = makeDeps();
    const { shutdown } = registerShutdownHandlers(deps);

    await shutdown('SIGTERM');
    const again = await shutdown('SIGTERM');

    expect(again).toBe(false);
    expect(deps.server.close).toHaveBeenCalledTimes(1);
  });

  it('exits with a failure code when closing throws', async () => {
    const { deps } = makeDeps({
      mongoose: { connection: { close: jest.fn().mockRejectedValue(new Error('db stuck')) } },
    });
    const { shutdown } = registerShutdownHandlers(deps);

    await shutdown('SIGTERM');

    expect(deps.proc.exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith('Lỗi khi tắt', expect.objectContaining({ reason: 'db stuck' }));
  });

  // Không có hẹn giờ thì một kết nối treo sẽ giữ tiến trình sống mãi và nền tảng
  // phải SIGKILL.
  it('force-exits when a connection refuses to close in time', async () => {
    jest.useFakeTimers();
    const { deps } = makeDeps({
      server: { close: jest.fn(() => { /* không bao giờ gọi callback */ }) },
    });
    const { shutdown } = registerShutdownHandlers({ ...deps, forceExitMs: 1000 });

    shutdown('SIGTERM');
    jest.advanceTimersByTime(1000);

    expect(deps.proc.exit).toHaveBeenCalledWith(1);
    jest.useRealTimers();
  });

  describe('xu ly loi khong bat duoc', () => {
    // Một promise hỏng ở nhánh phụ không đáng làm sập cả hệ thống.
    it('logs an unhandled rejection but keeps running', () => {
      const { handlers, deps } = makeDeps();
      registerShutdownHandlers(deps);

      handlers.unhandledRejection(new Error('loi phu'));

      expect(logger.error).toHaveBeenCalled();
      expect(deps.proc.exit).not.toHaveBeenCalled();
    });

    it('handles a non-Error rejection reason without throwing', () => {
      const { handlers, deps } = makeDeps();
      registerShutdownHandlers(deps);

      expect(() => handlers.unhandledRejection('chuoi thuong')).not.toThrow();
    });

    // Ngược lại, uncaughtException để tiến trình ở trạng thái không xác định.
    it('shuts down on an uncaught exception', () => {
      const { handlers, deps } = makeDeps();
      registerShutdownHandlers(deps);

      handlers.uncaughtException(new Error('hong nang'));

      expect(deps.server.close).toHaveBeenCalled();
    });
  });

  it('survives being given nothing to close', async () => {
    const { deps } = makeDeps({ server: undefined, io: undefined, mongoose: undefined });
    const { shutdown } = registerShutdownHandlers(deps);

    await expect(shutdown('SIGTERM')).resolves.toBe(true);
    expect(deps.proc.exit).toHaveBeenCalledWith(0);
  });
});
