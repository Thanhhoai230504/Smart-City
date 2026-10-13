jest.mock('../../src/jobs/environmentCron');
jest.mock('../../src/jobs/reportCron');
jest.mock('../../src/jobs/slaCron');
jest.mock('../../src/jobs/priorityCron');
jest.mock('../../src/jobs/embeddingCron');

/**
 * `started` là trạng thái cấp module nên mỗi test phải nạp lại registry.
 * Sau resetModules, các mock function là instance MỚI — phải require lại chúng
 * trong cùng lượt, không dùng reference bắt được ở đầu file.
 */
const loadFresh = () => {
  jest.resetModules();
  const fns = [
    require('../../src/jobs/environmentCron').startEnvironmentCron,
    require('../../src/jobs/reportCron').startReportCron,
    require('../../src/jobs/slaCron').startSlaCron,
    require('../../src/jobs/priorityCron').startPriorityCron,
    require('../../src/jobs/embeddingCron').startEmbeddingCron,
  ];
  fns.forEach((fn) => fn.mockImplementation(() => {}));
  return { startCrons: require('../../src/jobs').startCrons, fns };
};

describe('startCrons', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => { console.log.mockRestore(); jest.resetModules(); });

  it('starts all five cron jobs', () => {
    const { startCrons, fns } = loadFresh();
    startCrons();
    fns.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
  });

  // Mongoose tự reconnect ở tầng driver nên HTTP hoạt động lại sau khi DB trở về,
  // nhưng event 'connected' bắn lại sau MỖI lần reconnect. Không có cờ chống chạy
  // trùng thì mỗi lần đứt kết nối lại nhân đôi số cron job.
  it('is idempotent — repeated calls do not schedule the jobs again', () => {
    const { startCrons, fns } = loadFresh();
    expect(startCrons()).toBe(true);
    expect(startCrons()).toBe(false);
    expect(startCrons()).toBe(false);
    fns.forEach((fn) => expect(fn).toHaveBeenCalledTimes(1));
  });

  // Hai server dùng chung một database (VPS chạy thử song song với Render) thì
  // chỉ một bên được chạy cron, không thì email nhắc hạn bị gửi hai lần.
  it('starts no job when CRON_ENABLED=false', () => {
    process.env.CRON_ENABLED = 'false';
    try {
      const { startCrons, fns } = loadFresh();
      expect(startCrons()).toBe(false);
      fns.forEach((fn) => expect(fn).not.toHaveBeenCalled());
    } finally {
      delete process.env.CRON_ENABLED;
    }
  });

  it('still starts the remaining jobs if one of them throws', () => {
    const { startCrons, fns } = loadFresh();
    const [, , startSlaCron, startPriorityCron, startEmbeddingCron] = fns;
    startSlaCron.mockImplementation(() => { throw new Error('cron boom'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => startCrons()).not.toThrow();

    // Hai job đăng ký SAU job lỗi vẫn phải chạy.
    expect(startPriorityCron).toHaveBeenCalledTimes(1);
    expect(startEmbeddingCron).toHaveBeenCalledTimes(1);
    console.error.mockRestore();
  });
});
