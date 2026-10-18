const http = require('http');
const express = require('express');

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
// multer giả: coi như đã tải 2 ảnh lên Cloudinary rồi mới tới bước kiểm tra dữ liệu — đúng
// thứ tự thật (multipart phải qua multer mới có req.body).
jest.mock('../../src/middleware/upload', () => ({
  array: () => (req, res, cb) => {
    req.files = [
      { filename: 'smart-city-issues/a1', path: 'https://cdn.test/a1.jpg' },
      { filename: 'smart-city-issues/a2', path: 'https://cdn.test/a2.jpg' },
    ];
    cb();
  },
}));
jest.mock('../../src/config/cloudinary', () => ({ uploader: { destroy: jest.fn() } }));
jest.mock('../../src/middleware/auth', () => {
  const pass = (req, res, next) => next();
  return {
    authMiddleware: (req, res, next) => {
      req.user = { id: 'u1', role: 'user', name: 'Người dân' };
      next();
    },
    adminMiddleware: pass,
    staffMiddleware: pass,
    optionalAuthMiddleware: pass,
  };
});
jest.mock('../../src/services/issueService');

const cloudinary = require('../../src/config/cloudinary');
const issueService = require('../../src/services/issueService');
const issuesRouter = require('../../src/routes/issues');
const errorHandler = require('../../src/middleware/errorHandler');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/issues', issuesRouter);
  app.use(errorHandler);
  return app;
};

// Không có supertest trong dự án nên gọi thẳng qua http.
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

const flush = () => new Promise((resolve) => setImmediate(resolve));

const VALID = {
  title: 'Ổ gà trước số 12 Bạch Đằng',
  description: 'Ổ gà sâu, nguy hiểm cho xe máy.',
  category: 'pothole',
  location: '12 Bạch Đằng, Hải Châu, Đà Nẵng',
  latitude: 16.0678,
  longitude: 108.2244,
};

// Trước đây phiếu bị validator từ chối để lại ảnh trên Cloudinary: không phiếu nào giữ,
// không ai xoá (middleware/uploadImages.js chỉ thu hồi khi chính multer lỗi).
describe('POST /api/issues — ảnh của phiếu bị từ chối không thành ảnh rác', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
  });

  it('dữ liệu sai → 400 VALIDATION_ERROR, xoá mọi ảnh vừa tải, không tới service', async () => {
    const { status, body } = await post(buildApp(), '/api/issues', { ...VALID, title: '', latitude: 'abc' });
    await flush();

    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(issueService.createIssue).not.toHaveBeenCalled();
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(2);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('smart-city-issues/a1');
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('smart-city-issues/a2');
  });

  it('phiếu hợp lệ được lưu → giữ nguyên ảnh', async () => {
    issueService.createIssue.mockResolvedValue({ _id: 'i1', title: VALID.title });

    const { status } = await post(buildApp(), '/api/issues', VALID);
    await flush();

    expect(status).toBe(201);
    expect(issueService.createIssue).toHaveBeenCalledWith(expect.objectContaining({
      files: expect.arrayContaining([expect.objectContaining({ filename: 'smart-city-issues/a1' })]),
    }));
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
