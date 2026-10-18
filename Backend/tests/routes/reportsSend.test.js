const http = require('http');
const express = require('express');

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 'admin1', role: 'admin' };
    next();
  },
  adminMiddleware: (req, res, next) => next(),
}));
jest.mock('../../src/services/reportService', () => ({
  generateReport: jest.fn(),
  sendReportToAdmins: jest.fn(),
}));

const { sendReportToAdmins } = require('../../src/services/reportService');
const ApiError = require('../../src/utils/apiError');
const reportsRouter = require('../../src/routes/reports');
const errorHandler = require('../../src/middleware/errorHandler');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', reportsRouter);
  app.use(errorHandler);
  return app;
};

// Không có supertest trong dự án nên gọi thẳng qua http (cùng cách với
// tests/routes/authGoogleIdToken.test.js).
const post = (app, path, body) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const server = app.listen(0, () => {
      const req = http.request(
        {
          port: server.address().port,
          path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            server.close(() => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
          });
        }
      );
      req.on('error', (error) => server.close(() => reject(error)));
      req.end(payload);
    });
  });

// Trước đây route luôn trả "Đã gửi báo cáo ... cho admin", kể cả khi không thư nào đi.
describe('POST /api/reports/send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('báo đúng số quản trị viên đã nhận thư', async () => {
    sendReportToAdmins.mockResolvedValue({ total: 2, sent: 2, failed: 0 });

    const { status, body } = await post(buildApp(), '/api/reports/send', { type: 'weekly' });

    expect(status).toBe(200);
    expect(body.message).toBe('Đã gửi báo cáo tuần cho 2 quản trị viên.');
    expect(body.data).toEqual({ total: 2, sent: 2, failed: 0 });
  });

  it('gửi được một phần thì nói rõ số thư lỗi', async () => {
    sendReportToAdmins.mockResolvedValue({ total: 3, sent: 2, failed: 1 });

    const { status, body } = await post(buildApp(), '/api/reports/send', { type: 'monthly' });

    expect(status).toBe(200);
    expect(sendReportToAdmins).toHaveBeenCalledWith('monthly');
    expect(body.message).toBe('Đã gửi báo cáo tháng cho 2/3 quản trị viên; 1 thư gửi lỗi.');
    expect(body.data.failed).toBe(1);
  });

  it('không thư nào đi → trả lỗi kèm mã, không báo thành công', async () => {
    sendReportToAdmins.mockRejectedValue(ApiError.badGatewayWithCode(
      'Không gửi được báo cáo: máy chủ thư từ chối hoặc không kết nối được. Vui lòng thử lại sau.',
      'EMAIL_SEND_FAILED'
    ));

    const { status, body } = await post(buildApp(), '/api/reports/send', {});

    expect(status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.code).toBe('EMAIL_SEND_FAILED');
    expect(body.message).toMatch(/^Không gửi được báo cáo/);
  });

  it('chưa cấu hình SMTP → 503 EMAIL_NOT_CONFIGURED, câu báo giữ nguyên cả ở production', async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    sendReportToAdmins.mockRejectedValue(ApiError.serviceUnavailableWithCode(
      'Máy chủ chưa cấu hình gửi email (SMTP) nên chưa gửi được báo cáo.',
      'EMAIL_NOT_CONFIGURED'
    ));

    try {
      const { status, body } = await post(buildApp(), '/api/reports/send', { type: 'weekly' });
      expect(status).toBe(503);
      expect(body.code).toBe('EMAIL_NOT_CONFIGURED');
      expect(body.message).toContain('SMTP');
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});
