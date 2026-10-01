const { inspectEnv, validateEnv, REQUIRED } = require('../../src/config/validateEnv');

const goodEnv = (overrides = {}) => ({
  MONGODB_URI: 'mongodb+srv://user:pw@cluster/db',
  JWT_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  CLIENT_URL: 'https://smartcity.example.com',
  NODE_ENV: 'development',
  ...overrides,
});

describe('validateEnv.inspectEnv', () => {
  it('passes a well-formed configuration', () => {
    expect(inspectEnv(goodEnv()).errors).toEqual([]);
  });

  // Thiếu JWT_SECRET chỉ nổ khi có người đăng nhập — tức sau khi deploy đã
  // "thành công" và health check đã xanh.
  it.each(REQUIRED.map(([name]) => name))('reports a missing %s as a fatal error', (name) => {
    const env = goodEnv();
    delete env[name];

    const { errors } = inspectEnv(env);
    expect(errors.some((e) => e.includes(name))).toBe(true);
  });

  // Dùng chung một khoá cho access và refresh token nghĩa là chúng ký bằng cùng
  // chữ ký — một access token hết hạn có thể đem đi đổi như refresh token.
  it('rejects using the same secret for both token types', () => {
    const same = 'c'.repeat(40);
    const { errors } = inspectEnv(goodEnv({ JWT_SECRET: same, JWT_REFRESH_SECRET: same }));

    expect(errors.some((e) => e.includes('phải khác nhau'))).toBe(true);
  });

  it('rejects a short signing secret', () => {
    const { errors } = inspectEnv(goodEnv({ JWT_SECRET: 'short' }));
    expect(errors.some((e) => e.includes('JWT_SECRET') && e.includes('ngắn'))).toBe(true);
  });

  describe('production', () => {
    // CLIENT_URL vẫn trỏ localhost ở production nghĩa là CORS sẽ chặn chính
    // frontend của mình — một lỗi deploy im lặng và rất khó đoán.
    it('refuses a localhost CLIENT_URL', () => {
      const { errors } = inspectEnv(goodEnv({
        NODE_ENV: 'production',
        CLIENT_URL: 'http://localhost:3000',
      }));

      expect(errors.some((e) => e.includes('CLIENT_URL'))).toBe(true);
    });

    it('accepts a real CLIENT_URL', () => {
      const { errors } = inspectEnv(goodEnv({ NODE_ENV: 'production' }));
      expect(errors).toEqual([]);
    });

    it('does not apply the production check in development', () => {
      const { errors } = inspectEnv(goodEnv({ CLIENT_URL: 'http://localhost:3000' }));
      expect(errors).toEqual([]);
    });
  });

  describe('biến tuỳ chọn', () => {
    // Dừng server vì chưa có khoá Gemini là phản ứng thái quá — chỉ cảnh báo.
    it('only warns about a missing optional key', () => {
      const env = goodEnv();
      const { errors, warnings } = inspectEnv(env);

      expect(errors).toEqual([]);
      expect(warnings.some((w) => w.includes('GEMINI_API_KEY'))).toBe(true);
    });

    it('says what stops working, not just what is missing', () => {
      const { warnings } = inspectEnv(goodEnv());
      const cloudinary = warnings.find((w) => w.includes('CLOUDINARY_API_KEY'));
      expect(cloudinary).toContain('upload ảnh');
    });
  });
});

describe('validateEnv', () => {
  it('exits the process when the configuration is fatally broken', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const env = goodEnv();
    delete env.JWT_SECRET;

    expect(() => validateEnv(env)).toThrow('process.exit called');
    expect(exit).toHaveBeenCalledWith(1);

    exit.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
  });

  it('does not exit for warnings alone', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    validateEnv(goodEnv());

    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
    console.warn.mockRestore();
  });
});
