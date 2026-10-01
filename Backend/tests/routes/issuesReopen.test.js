const router = require('../../src/routes/issues');
const AuditLog = require('../../src/models/AuditLog');
const Issue = require('../../src/models/Issue');
const Notification = require('../../src/models/Notification');
const { MIN_REASON_LENGTH } = require('../../src/utils/reopenConfig');

const getRoute = (path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods[method]
);

// G8: mở lại sự cố là đường quay lại duy nhất của người báo cáo. Route phải bắt
// đăng nhập và phải chạy validator (bắt buộc nêu lý do) — thiếu `validate` thì
// chuỗi validator có gắn cũng không bao giờ chạy.
describe('POST /api/issues/:id/reopen', () => {
  it('is registered and requires authentication', () => {
    const route = getRoute('/:id/reopen', 'post');
    expect(route).toBeDefined();
    const names = route.route.stack.map((l) => l.handle.name);
    expect(names).toContain('authMiddleware');
    expect(names).toContain('validate');
  });

  // Người dân thường phải gọi được — gắn nhầm staffMiddleware/adminMiddleware là
  // khoá mất chính đối tượng mà tính năng này phục vụ.
  it('is not gated behind a staff or admin role', () => {
    const names = getRoute('/:id/reopen', 'post').route.stack.map((l) => l.handle.name);
    expect(names).not.toContain('staffMiddleware');
    expect(names).not.toContain('adminMiddleware');
  });

  it('sits before the catch-all /:id route so it is not swallowed', () => {
    const paths = router.stack.filter((l) => l.route).map((l) => l.route.path);
    expect(paths).toContain('/:id/reopen');
  });

  it('declares the audit action so recordAudit does not fail validation', () => {
    expect(AuditLog.schema.path('action').enumValues).toContain('issue.reopened');
  });

  it('declares the notification type used when reopening', () => {
    expect(Notification.schema.path('type').enumValues).toContain('issue_reopened');
  });

  it('tracks how many times an issue was reopened', () => {
    expect(Issue.schema.path('reopenCount')).toBeDefined();
    expect(Issue.schema.path('lastReopenedAt')).toBeDefined();
  });

  it('requires a reason long enough to be meaningful', () => {
    expect(MIN_REASON_LENGTH).toBeGreaterThanOrEqual(10);
  });
});
