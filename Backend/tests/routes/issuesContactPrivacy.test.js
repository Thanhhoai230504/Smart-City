const router = require('../../src/routes/issues');

const getRoute = (path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods[method]
);

describe('Issue detail route identifies the caller', () => {
  // Service chỉ trả `phone`/email khi `requester` là admin/cán bộ. Nếu route quên
  // gắn optionalAuthMiddleware thì req.user luôn undefined: khách vẫn an toàn,
  // nhưng cán bộ mất thông tin liên hệ cần để xử lý sự cố.
  it('attaches optional authentication to GET /:id', () => {
    const route = getRoute('/:id', 'get');
    expect(route).toBeDefined();
    const handlerNames = route.route.stack.map((layer) => layer.handle.name);
    expect(handlerNames).toContain('optionalAuthMiddleware');
  });

  it('keeps GET /:id public — no mandatory auth or role gate', () => {
    const handlerNames = getRoute('/:id', 'get').route.stack.map((layer) => layer.handle.name);
    expect(handlerNames).not.toContain('authMiddleware');
    expect(handlerNames).not.toContain('adminMiddleware');
    expect(handlerNames).not.toContain('staffMiddleware');
  });
});
