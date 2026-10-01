import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllowedStatusTargets,
  setStatusTransitions,
  STATUS_MAP,
  CATEGORY_MAP,
  MAX_REOPEN_COUNT,
} from './constants';

/**
 * Bảng chuyển trạng thái quyết định nút nào hiện ra trên ba màn hình quản trị.
 *
 * Nguồn thật là `GET /api/meta/enums`; bản cứng ở đây chỉ là dự phòng để bộ chọn
 * không rỗng khi meta chưa kịp về. Backend luôn là nơi phán quyết cuối cùng và
 * trả 400 với code `INVALID_STATUS_TRANSITION` nếu client gọi sai.
 */
describe('getAllowedStatusTargets', () => {
  // Bảng là trạng thái cấp module nên phải khôi phục giữa các test.
  const FALLBACK = {
    reported: ['processing', 'resolved', 'rejected'],
    processing: ['resolved', 'rejected'],
    resolved: ['processing'],
    rejected: ['processing'],
  };

  beforeEach(() => setStatusTransitions(FALLBACK));

  // Lùi phiếu đã xử lý về "mới báo cáo" xoá mất dấu vết đã có người tiếp nhận.
  // Trước đây bảng quản trị sự cố hiện cả lựa chọn này ngay trên giao diện.
  it.each(['reported', 'processing', 'resolved', 'rejected'])(
    'never offers "reported" as a target from %s',
    (from) => {
      expect(getAllowedStatusTargets(from)).not.toContain('reported');
    }
  );

  it('lets a closed issue be reopened only through processing', () => {
    expect(getAllowedStatusTargets('resolved')).toEqual(['processing']);
    expect(getAllowedStatusTargets('rejected')).toEqual(['processing']);
  });

  it('returns an empty list for an unknown status instead of throwing', () => {
    expect(getAllowedStatusTargets('archived')).toEqual([]);
    expect(getAllowedStatusTargets(undefined)).toEqual([]);
    expect(getAllowedStatusTargets(null)).toEqual([]);
  });

  describe('setStatusTransitions', () => {
    it('lets the server override the built-in table', () => {
      setStatusTransitions({ reported: ['resolved'] });
      expect(getAllowedStatusTargets('reported')).toEqual(['resolved']);
    });

    // Không có bản dự phòng thì meta lỗi là bộ chọn rỗng và người dùng không
    // đổi được trạng thái nào cả.
    it.each([undefined, null, {}])('keeps the fallback when the server sends %p', (bad) => {
      setStatusTransitions(bad as never);
      expect(getAllowedStatusTargets('reported')).toEqual(FALLBACK.reported);
    });
  });
});

describe('bảng nhãn hiển thị', () => {
  it.each(['reported', 'processing', 'resolved', 'rejected'])(
    'gives status %s a label, colour and icon',
    (status) => {
      expect(STATUS_MAP[status]).toMatchObject({
        label: expect.any(String),
        color: expect.stringMatching(/^#[0-9A-F]{6}$/i),
        icon: expect.any(String),
      });
    }
  );

  it.each(['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'])(
    'gives category %s a Vietnamese label',
    (category) => {
      expect(CATEGORY_MAP[category].label).toBeTruthy();
    }
  );

  it('caps reopens so one issue cannot be bounced forever', () => {
    expect(MAX_REOPEN_COUNT).toBeGreaterThan(0);
    expect(MAX_REOPEN_COUNT).toBeLessThanOrEqual(3);
  });
});
