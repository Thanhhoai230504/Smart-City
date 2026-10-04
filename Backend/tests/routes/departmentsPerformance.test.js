const { validationResult } = require('express-validator');
const router = require('../../src/routes/departments');
const { performanceQueryValidator } = require('../../src/validators/departmentValidator');

/**
 * Đánh giá đơn vị là dữ liệu nội bộ để khen thưởng/phê bình — chỉ quản trị viên.
 * Route bảng xếp hạng phải nằm TRƯỚC `/:id`, nếu không Express hiểu "performance"
 * là một mã đơn vị.
 */
const routes = router.stack.filter((l) => l.route).map((l) => ({
  path: l.route.path,
  method: Object.keys(l.route.methods)[0],
  names: l.route.stack.map((s) => s.handle.name),
}));
const find = (path) => routes.find((r) => r.path === path && r.method === 'get');

describe('GET /api/departments/performance', () => {
  it('requires an admin and validates the period before the controller', () => {
    const r = find('/performance');
    expect(r).toBeDefined();
    expect(r.names).toEqual(expect.arrayContaining(['authMiddleware', 'adminMiddleware', 'validate']));
    expect(r.names.indexOf('validate')).toBeLessThan(r.names.length - 1);
  });

  it('is registered before the catch-all /:id route', () => {
    const idx = (p) => routes.findIndex((r) => r.path === p && r.method === 'get');
    expect(idx('/performance')).toBeLessThan(idx('/:id'));
  });
});

describe('GET /api/departments/:id/performance', () => {
  it('requires an admin and validates input', () => {
    const r = find('/:id/performance');
    expect(r).toBeDefined();
    expect(r.names).toEqual(expect.arrayContaining(['authMiddleware', 'adminMiddleware', 'validate']));
  });
});

describe('performanceQueryValidator', () => {
  const run = async (query, params = {}) => {
    const req = { query, params };
    for (const chain of performanceQueryValidator) await chain.run(req);
    return validationResult(req).array().map((e) => e.path);
  };

  it('accepts ISO dates and an empty query (defaults to the last 30 days)', async () => {
    expect(await run({})).toEqual([]);
    expect(await run({ from: '2026-09-01T00:00:00+07:00', to: '2026-09-30T23:59:59+07:00' })).toEqual([]);
  });

  it.each([['from', 'hôm qua'], ['to', '31/09/2026'], ['from', { $gt: '' }]])('rejects a bad %s', async (field, value) => {
    expect(await run({ [field]: value })).toContain(field);
  });

  it('rejects a malformed department id on the detail route', async () => {
    expect(await run({}, { id: 'abc' })).toContain('id');
  });
});
