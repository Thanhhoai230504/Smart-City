const { validationResult } = require('express-validator');
const router = require('../../src/routes/departments');
const {
  createEvaluationValidator,
  revokeEvaluationValidator,
  evaluationListValidator,
} = require('../../src/validators/departmentValidator');
const ApiError = require('../../src/utils/apiError');

/**
 * Quyết định khen thưởng / phê bình: chỉ quản trị viên ghi và huỷ; cán bộ xem được
 * quyết định về đơn vị mình (service kiểm tra đúng đơn vị).
 */
const routes = router.stack.filter((l) => l.route).map((l) => ({
  path: l.route.path,
  method: Object.keys(l.route.methods)[0],
  names: l.route.stack.map((s) => s.handle.name),
}));
const find = (method, path) => routes.find((r) => r.path === path && r.method === method);

describe('department evaluation routes', () => {
  it('only admins can record a decision, and input is validated first', () => {
    const r = find('post', '/:id/evaluations');
    expect(r).toBeDefined();
    expect(r.names).toEqual(expect.arrayContaining(['authMiddleware', 'adminMiddleware', 'validate']));
    expect(r.names.indexOf('validate')).toBe(r.names.length - 2);
  });

  it('only admins can revoke a decision', () => {
    const r = find('post', '/:id/evaluations/:evaluationId/revoke');
    expect(r).toBeDefined();
    expect(r.names).toEqual(expect.arrayContaining(['authMiddleware', 'adminMiddleware', 'validate']));
  });

  it('staff and admins can list decisions (department scope checked in the service)', () => {
    const r = find('get', '/:id/evaluations');
    expect(r).toBeDefined();
    expect(r.names).toEqual(expect.arrayContaining(['authMiddleware', 'staffMiddleware', 'validate']));
    expect(r.names).not.toContain('adminMiddleware');
  });
});

const run = async (chains, { body = {}, params = { id: '6a6732404513fe4ab8577236' } } = {}) => {
  const req = { body, params, query: {} };
  for (const chain of chains) await chain.run(req);
  return validationResult(req).array().map((e) => e.path);
};

describe('createEvaluationValidator', () => {
  const ok = {
    from: '2026-09-01T00:00:00+07:00',
    to: '2026-09-30T23:59:59+07:00',
    decision: 'commend',
    content: 'Đơn vị hoàn thành xuất sắc nhiệm vụ trong tháng.',
  };

  it('accepts a complete decision', async () => {
    expect(await run(createEvaluationValidator, { body: ok })).toEqual([]);
    expect(await run(createEvaluationValidator, { body: { ...ok, documentNumber: '125/QĐ-UBND', deviationReason: 'Có thành tích đột xuất được người dân ghi nhận.' } })).toEqual([]);
  });

  it.each([
    ['from', { from: undefined }],
    ['to', { to: '30/09/2026' }],
    ['decision', { decision: 'fire' }],
    ['content', { content: 'Tốt' }],
    ['content', { content: 'x'.repeat(2001) }],
    ['documentNumber', { documentNumber: 'x'.repeat(101) }],
    ['deviationReason', { deviationReason: 'ngắn' }],
  ])('rejects a bad %s', async (field, patch) => {
    expect(await run(createEvaluationValidator, { body: { ...ok, ...patch } })).toContain(field);
  });

  it('rejects a malformed department id', async () => {
    expect(await run(createEvaluationValidator, { body: ok, params: { id: 'abc' } })).toContain('id');
  });
});

describe('revokeEvaluationValidator', () => {
  const params = { id: '6a6732404513fe4ab8577236', evaluationId: '6a6732404513fe4ab8577999' };

  it('requires a meaningful reason', async () => {
    expect(await run(revokeEvaluationValidator, { body: { reason: 'Ghi nhầm kỳ đánh giá' }, params })).toEqual([]);
    expect(await run(revokeEvaluationValidator, { body: { reason: 'nhầm' }, params })).toContain('reason');
    expect(await run(revokeEvaluationValidator, { body: {}, params })).toContain('reason');
  });

  it('rejects malformed ids', async () => {
    expect(await run(revokeEvaluationValidator, { body: { reason: 'Ghi nhầm kỳ đánh giá' }, params: { id: '1', evaluationId: '2' } }))
      .toEqual(expect.arrayContaining(['id', 'evaluationId']));
  });
});

describe('evaluationListValidator', () => {
  it('rejects a malformed department id', async () => {
    expect(await run(evaluationListValidator, { params: { id: 'abc' } })).toContain('id');
  });
});

describe('ApiError.conflictWithCode', () => {
  it('creates a 409 with a machine-readable code', () => {
    const e = ApiError.conflictWithCode('Đã có quyết định', 'EVALUATION_EXISTS');
    expect(e.statusCode).toBe(409);
    expect(e.code).toBe('EVALUATION_EXISTS');
  });
});
