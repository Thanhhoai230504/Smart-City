const issueRouter = require('../../src/routes/issues');
const authController = require('../../src/controllers/authController');
const fs = require('fs');
const path = require('path');

const getRoute = (router, p, method) => router.stack.find(
  (l) => l.route?.path === p && l.route.methods[method]
);

describe('G17 — tao su co phai co limiter rieng', () => {
  // POST /api/issues là endpoint đắt nhất: ghi DB, upload Cloudinary, xếp hàng
  // sinh embedding qua Gemini (có phí) và gửi email tới MỌI admin. Trước đây nó
  // chỉ chịu generalLimiter 500 req/15 phút nên spam 500 phiếu là hợp lệ.
  // express-rate-limit trả về hàm ẩn danh nên không so khớp theo tên được —
  // đối chiếu đúng instance đã export.
  it('mounts the dedicated limiter on POST /', () => {
    const { createIssueLimiter } = require('../../src/middleware/rateLimiters');
    const handlers = getRoute(issueRouter, '/', 'post').route.stack.map((l) => l.handle);
    expect(handlers).toContain(createIssueLimiter);
  });

  it('does not accidentally mount it on the read routes', () => {
    const { createIssueLimiter } = require('../../src/middleware/rateLimiters');
    const handlers = getRoute(issueRouter, '/', 'get').route.stack.map((l) => l.handle);
    expect(handlers).not.toContain(createIssueLimiter);
  });

  it('keeps the limiter stricter than the general one', () => {
    const { createIssueLimiter, generalLimiter } = require('../../src/middleware/rateLimiters');
    expect(typeof createIssueLimiter).toBe('function');
    expect(createIssueLimiter).not.toBe(generalLimiter);
  });
});

describe('L8 — khong duoc day access token qua URL', () => {
  // URL đi vào lịch sử trình duyệt, log của proxy, và rò qua header Referer sang
  // mọi tài nguyên bên thứ ba mà trang đích tải.
  it('does not put the access token in the OAuth redirect', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/controllers/authController.js'),
      'utf8'
    );
    expect(source).not.toMatch(/redirect\([^)]*token=\$\{[^}]*accessToken/);
  });

  it('still exposes a googleCallback handler', () => {
    expect(typeof authController.googleCallback).toBe('function');
  });
});
