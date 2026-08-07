const router = require('../../src/routes/issues');

const getRoute = (path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods[method]
);

describe('Issue duplicate candidate routes', () => {
  it('protects user candidate requests with auth, rate limit and validation', () => {
    const route = getRoute('/duplicate-candidates', 'post');
    const names = route.route.stack.map((layer) => layer.handle.name);
    const validateIndex = names.indexOf('validate');

    expect(names[0]).toBe('authMiddleware');
    expect(validateIndex).toBeGreaterThan(1);
    expect(names.at(-1)).toBe('getDuplicateCandidates');
    // express-rate-limit exposes an anonymous middleware in the current version.
    expect(names.slice(1, validateIndex)).toContain('');
  });

  it('protects existing-issue candidate lookup as admin-only', () => {
    const route = getRoute('/:id/duplicate-candidates', 'get');
    const names = route.route.stack.map((layer) => layer.handle.name);
    expect(names).toEqual(expect.arrayContaining(['authMiddleware', 'adminMiddleware']));
  });

  it('declares static candidate routes before the dynamic detail route', () => {
    const candidateIndex = router.stack.findIndex((layer) => layer.route?.path === '/duplicate-candidates');
    const detailIndex = router.stack.findIndex((layer) => layer.route?.path === '/:id');
    expect(candidateIndex).toBeLessThan(detailIndex);
  });
});
