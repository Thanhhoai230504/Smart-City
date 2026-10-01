const { logger, redact } = require('../../src/utils/logger');

describe('logger.redact', () => {
  // Log thường được gửi sang dịch vụ bên thứ ba và giữ lâu hơn database.
  it.each([
    'password', 'newPassword', 'currentPassword',
    'token', 'accessToken', 'refreshToken', 'tokenHash',
    'authorization', 'cookie', 'apiKey', 'secret',
  ])('masks %s', (key) => {
    expect(redact({ [key]: 'nhay-cam' })[key]).toBe('[redacted]');
  });

  it('keeps harmless fields intact', () => {
    expect(redact({ userId: 'u1', path: '/api/issues' }))
      .toEqual({ userId: 'u1', path: '/api/issues' });
  });

  it('masks nested secrets too', () => {
    const out = redact({ user: { id: 'u1', password: 'pw' } });
    expect(out.user.password).toBe('[redacted]');
    expect(out.user.id).toBe('u1');
  });

  it('leaves dates and arrays alone', () => {
    const date = new Date('2026-10-01');
    const out = redact({ at: date, tags: ['a', 'b'] });
    expect(out.at).toBe(date);
    expect(out.tags).toEqual(['a', 'b']);
  });

  it('handles non-objects without throwing', () => {
    expect(redact(null)).toBeNull();
    expect(redact('text')).toBe('text');
  });
});

describe('logger levels', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...OLD_ENV };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => { process.env = OLD_ENV; });

  it('routes each level to the matching console method', () => {
    process.env.LOG_LEVEL = 'debug';
    logger.error('e');
    logger.warn('w');
    logger.info('i');

    expect(console.error).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });

  it('suppresses anything below the configured level', () => {
    process.env.LOG_LEVEL = 'error';
    logger.info('khong duoc in');
    logger.warn('khong duoc in');

    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  // Render/CloudWatch parse được JSON một dòng; máy phát triển thì cần dễ đọc.
  it('emits one-line JSON in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'info';
    logger.info('da gui email', { subject: 'Xac thuc' });

    const line = console.log.mock.calls[0][0];
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: 'info', message: 'da gui email', subject: 'Xac thuc' });
    expect(typeof parsed.time).toBe('string');
  });

  it('redacts secrets even in production JSON', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'info';
    logger.info('login', { password: 'sieu-bi-mat' });

    expect(console.log.mock.calls[0][0]).not.toContain('sieu-bi-mat');
  });

  it('prints a readable line outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'info';
    logger.info('san sang');

    expect(console.log).toHaveBeenCalledWith('[info] san sang');
  });
});
