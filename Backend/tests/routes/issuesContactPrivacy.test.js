const router = require('../../src/routes/issues');

const getRoute = (path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods[method]
);

// Danh sách công khai không nhận diện người gọi nữa: trước đây cán bộ xem danh sách/bản
// đồ công khai chỉ thấy phiếu của đơn vị mình, còn trang quản trị mất email khi token
// vừa hết hạn (rơi về bản của khách). Việc cần quyền đi qua /work.
describe('Issue list routes', () => {
  it('GET / is the same public list for everyone (no auth middleware at all)', () => {
    const handlerNames = getRoute('/', 'get').route.stack.map((layer) => layer.handle.name);
    expect(handlerNames).not.toContain('optionalAuthMiddleware');
    expect(handlerNames).not.toContain('authMiddleware');
  });

  it('GET /work requires login and a staff/admin role', () => {
    const handlerNames = getRoute('/work', 'get').route.stack.map((layer) => layer.handle.name);
    expect(handlerNames).toEqual(expect.arrayContaining(['authMiddleware', 'staffMiddleware']));
  });
});

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
