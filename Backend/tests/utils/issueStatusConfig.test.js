const {
  ALLOWED_TRANSITIONS,
  canTransition,
  getAllowedTargets,
} = require('../../src/utils/issueStatusConfig');

describe('issueStatusConfig', () => {
  // 'reported' không bao giờ là đích đến: lùi phiếu đã được tiếp nhận về "mới báo
  // cáo" xoá mất dấu vết đã có người xử lý. Trước đây API nhận mọi cặp chuyển
  // tiếp nên PATCH /:id/status với status='reported' lùi được phiếu đã resolved.
  it.each(['reported', 'processing', 'resolved', 'rejected'])(
    'never allows moving back to reported (from %s)',
    (from) => {
      expect(canTransition(from, 'reported')).toBe(false);
    }
  );

  it.each([
    ['reported', 'processing'],
    ['reported', 'resolved'],
    ['reported', 'rejected'],
    ['processing', 'resolved'],
    ['processing', 'rejected'],
    // Hai trạng thái đóng chỉ mở lại được bằng cách quay về 'processing',
    // không nhảy thẳng sang nhau.
    ['resolved', 'processing'],
    ['rejected', 'processing'],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([['resolved', 'rejected'], ['rejected', 'resolved']])(
    'does not allow jumping between the two closed states (%s -> %s)',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    }
  );

  // No-op bị chặn có chủ đích: gửi lại 'resolved' trên phiếu đã resolved sẽ
  // ghi đè resolvedAt (làm sai thống kê thời gian xử lý) và gửi lại email mời
  // đánh giá cho người dân, trong khi rating chỉ được chấm một lần.
  it.each(['reported', 'processing', 'resolved', 'rejected'])(
    'rejects a no-op transition on %s',
    (status) => {
      expect(canTransition(status, status)).toBe(false);
    }
  );

  it('rejects an unknown target', () => {
    expect(canTransition('reported', 'reopened')).toBe(false);
    expect(canTransition('reported', undefined)).toBe(false);
  });

  it('rejects an unknown source', () => {
    expect(canTransition('archived', 'processing')).toBe(false);
    expect(canTransition(undefined, 'processing')).toBe(false);
  });

  it('exposes the allowed targets so clients can build their pickers', () => {
    expect(getAllowedTargets('reported')).toEqual(['processing', 'resolved', 'rejected']);
    expect(getAllowedTargets('resolved')).toEqual(['processing']);
    expect(getAllowedTargets('archived')).toEqual([]);
  });

  it('covers every status as a source', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(
      ['processing', 'rejected', 'reported', 'resolved']
    );
  });
});
