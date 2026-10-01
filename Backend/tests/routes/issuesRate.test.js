const { validationResult } = require('express-validator');
const router = require('../../src/routes/issues');
const { rateIssueValidator } = require('../../src/validators/issueValidator');

/**
 * `POST /api/issues/:id/rate` trước đây KHÔNG có validator nào. Model có
 * `min: 1, max: 5` nhưng không đủ:
 *
 * - Thiếu `score`: Mongoose lấy default null, lưu một bản đánh giá rỗng, rồi
 *   vẫn gửi thông báo "bị chấm undefined/5 sao" tới cán bộ. Kiểm tra
 *   ALREADY_RATED dựa vào `score`, nên còn gửi lại được nhiều lần.
 * - `score: 3.7` lọt qua min/max và làm lệch điểm trung bình công khai.
 */
const getRoute = (path, method) => router.stack.find(
  (layer) => layer.route?.path === path && layer.route.methods[method]
);

const run = async (body) => {
  const req = { body };
  for (const chain of rateIssueValidator) await chain.run(req);
  return validationResult(req).array().map((e) => e.path);
};

describe('POST /api/issues/:id/rate — validation', () => {
  it('runs the validator chain before the controller', () => {
    const names = getRoute('/:id/rate', 'post').route.stack.map((l) => l.handle.name);
    expect(names).toContain('authMiddleware');
    expect(names).toContain('validate');
    expect(names.indexOf('validate')).toBeLessThan(names.indexOf('rateIssue'));
  });

  it.each([[1], [3], [5], ['4']])('accepts score %p', async (score) => {
    expect(await run({ score })).toEqual([]);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['zero', 0],
    ['six', 6],
    ['fractional', 3.7],
    ['text', 'abc'],
  ])('rejects a %s score', async (_, score) => {
    expect(await run({ score })).toContain('score');
  });

  it('accepts an absent or empty comment', async () => {
    expect(await run({ score: 4 })).toEqual([]);
    expect(await run({ score: 4, comment: '' })).toEqual([]);
    expect(await run({ score: 4, comment: null })).toEqual([]);
  });

  it('caps the comment at 500 characters, like the model', async () => {
    expect(await run({ score: 4, comment: 'a'.repeat(500) })).toEqual([]);
    expect(await run({ score: 4, comment: 'a'.repeat(501) })).toContain('comment');
  });

  it('rejects a non-string comment', async () => {
    expect(await run({ score: 4, comment: { $gt: '' } })).toContain('comment');
  });
});
