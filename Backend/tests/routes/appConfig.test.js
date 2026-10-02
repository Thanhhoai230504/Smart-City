const http = require('http');
const express = require('express');

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { logger } = require('../../src/utils/logger');
const appRouter = require('../../src/routes/app');

const buildApp = () => {
  const app = express();
  app.use('/api/app', appRouter);
  return app;
};

// Không có supertest trong dự án nên gọi thẳng qua http trên cổng tạm (cùng
// cách với tests/routes/cameras.test.js).
const get = (app, path, headers = {}) =>
  new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request(
        { port: server.address().port, path, method: 'GET', headers },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            server.close(() => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(raw) }));
          });
        }
      );
      req.on('error', (error) => server.close(() => reject(error)));
      req.end();
    });
  });

describe('GET /api/app/config', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.clearAllMocks();
  });

  it('công khai, trả ngưỡng phiên bản + quyết định cho bản đang gọi', async () => {
    process.env.MOBILE_MIN_SUPPORTED_VERSION = '1.1.0';
    process.env.MOBILE_LATEST_VERSION = '1.2.0';

    const { status, body } = await get(buildApp(), '/api/app/config', { 'X-App-Version': '1.0.5' });

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      minSupportedVersion: '1.1.0',
      latestVersion: '1.2.0',
      clientVersion: '1.0.5',
      forceUpdate: true,
      updateAvailable: true,
    });
  });

  it('ghi log phiên bản client — biết còn bao nhiêu máy chạy bản cũ', async () => {
    await get(buildApp(), '/api/app/config', { 'X-App-Version': '1.0.0', 'User-Agent': 'Dart/3.11 (dart:io)' });

    expect(logger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ event: 'app_version_seen', appVersion: '1.0.0' })
    );
  });

  it('header version rác/quá dài bị bỏ qua, không ném lỗi', async () => {
    const { status, body } = await get(buildApp(), '/api/app/config', { 'X-App-Version': 'x'.repeat(200) });

    expect(status).toBe(200);
    expect(body.data.clientVersion).toBeNull();
    expect(body.data.forceUpdate).toBe(false);
  });

  it('không cho proxy/CDN cache lâu — đổi ngưỡng phải có hiệu lực nhanh', async () => {
    const { headers } = await get(buildApp(), '/api/app/config');
    expect(headers['cache-control']).toBe('public, max-age=300');
  });
});
