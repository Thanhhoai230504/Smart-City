const router = require('../../src/routes/issues');

const getRoute = (path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods[method]
);

describe('Issue priority route permissions', () => {
  it.each([
    ['/priority/config', 'get'],
    ['/priority/recalculate', 'post'],
    ['/:id/recalculate-priority', 'post'],
  ])('protects %s with authentication and admin middleware', (path, method) => {
    const route = getRoute(path, method);
    expect(route).toBeDefined();
    const handlerNames = route.route.stack.map((layer) => layer.handle.name);
    expect(handlerNames).toEqual(expect.arrayContaining(['authMiddleware', 'adminMiddleware']));
  });

  it('declares static priority routes before the dynamic issue detail route', () => {
    const priorityIndex = router.stack.findIndex((layer) => layer.route?.path === '/priority/config');
    const detailIndex = router.stack.findIndex((layer) => layer.route?.path === '/:id');
    expect(priorityIndex).toBeGreaterThanOrEqual(0);
    expect(priorityIndex).toBeLessThan(detailIndex);
  });
});
