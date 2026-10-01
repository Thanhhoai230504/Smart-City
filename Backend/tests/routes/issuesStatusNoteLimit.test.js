const router = require('../../src/routes/issues');

const getRoute = (path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods[method]
);

// E3: giới hạn ghi chú trạng thái trước đây chỉ tồn tại ở client nên gọi API thẳng
// là bỏ qua được. App mobile là client thứ hai — ràng buộc phải nằm ở server, trên
// MỌI route ghi statusHistory.note.
describe('Every status-note write path validates note length server-side', () => {
  it.each([
    ['/:id/status', 'patch'],
    ['/:id/assign', 'post'],
    ['/:id/unassign', 'post'],
  ])('runs a validator chain on %s %s', (path, method) => {
    const route = getRoute(path, method);
    expect(route).toBeDefined();
    const handlerNames = route.route.stack.map((layer) => layer.handle.name);
    // `validate` là middleware đọc kết quả express-validator; thiếu nó thì chuỗi
    // validator có gắn cũng không bao giờ chạy.
    expect(handlerNames).toContain('validate');
  });

  it('keeps the unassign route admin-only', () => {
    const handlerNames = getRoute('/:id/unassign', 'post').route.stack.map((l) => l.handle.name);
    expect(handlerNames).toContain('authMiddleware');
    expect(handlerNames).toContain('adminMiddleware');
  });
});
