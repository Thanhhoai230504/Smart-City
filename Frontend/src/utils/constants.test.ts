import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllowedStatusTargets,
  setStatusTransitions,
  STATUS_MAP,
  CATEGORY_MAP,
  PRIORITY_MAP,
  SLA_STATUS_MAP,
  REOPENED_BADGE,
} from './constants';
import { DEFAULT_REOPEN_RULES } from './reopen';
import { NOTIFICATION_TYPES } from './constants';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    expect(DEFAULT_REOPEN_RULES.maxCount).toBeGreaterThan(0);
    expect(DEFAULT_REOPEN_RULES.maxCount).toBeLessThanOrEqual(3);
  });
});

/**
 * Tương phản chữ trên chip — WCAG 2.1 relative luminance, ngưỡng AA 4.5:1.
 *
 * Test này tồn tại vì lỗi cũ không ai thấy bằng mắt thường trên màn hình sáng:
 * chip "Đang xử lý" từng chỉ đạt 2.15:1. Ai đổi màu mà làm tụt dưới ngưỡng thì
 * test đỏ ngay, không phải đợi người dùng ngoài nắng phàn nàn.
 */
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('chip colours meet WCAG AA (4.5:1) for text', () => {
  it('measures a known pair correctly, so the checks below can be trusted', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    // Màu cũ của "Đang xử lý" — phải đo ra đúng con số đã ghi trong tài liệu.
    expect(contrast('#F59E0B', '#FFFFFF')).toBeCloseTo(2.15, 2);
  });

  it.each(Object.entries(STATUS_MAP))('status %s', (_, s) => {
    expect(contrast(s.text, s.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(PRIORITY_MAP))('priority %s', (_, p) => {
    expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(SLA_STATUS_MAP))('SLA %s', (_, s) => {
    expect(contrast(s.text, s.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('reopened badge', () => {
    expect(contrast(REOPENED_BADGE.text, REOPENED_BADGE.bg)).toBeGreaterThanOrEqual(4.5);
  });

  // Màu đồ hoạ (`color`) giữ tươi cho biểu đồ, nhưng không được bị dùng làm chữ:
  // nếu `text` vô tình trùng `color` thì quy ước hai vai trò đã bị phá.
  it('keeps the graphic colour separate from the text colour', () => {
    for (const s of Object.values(STATUS_MAP)) expect(s.text).not.toBe(s.color);
    for (const p of Object.values(PRIORITY_MAP)) expect(p.text).not.toBe(p.color);
  });
});

/**
 * Loại thông báo phía web phải khớp ĐÚNG enum của model backend.
 *
 * Đọc thẳng source của model thay vì chép tay một danh sách thứ ba. Danh sách
 * phía web đã lệch backend ba lần — mỗi lần backend thêm một loại thông báo mới
 * (intake_overdue, issue_reopened, issue_rated, issue_unassigned) mà quên web.
 */
const BACKEND_MODEL = resolve(__dirname, '../../../Backend/src/models/Notification.js');

describe('notification types stay in sync with the backend', () => {
  it.skipIf(!existsSync(BACKEND_MODEL))('matches the enum in Backend/src/models/Notification.js', () => {
    const source = readFileSync(BACKEND_MODEL, 'utf8');
    const block = source.match(/type:\s*\{\s*type:\s*String,\s*enum:\s*\[([\s\S]*?)\]/);
    expect(block, 'không tìm thấy enum `type` trong model Notification').not.toBeNull();
    const backend = [...block![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

    expect(backend.length).toBeGreaterThan(5); // regex hỏng thì không được pass ăn may
    expect([...NOTIFICATION_TYPES].sort()).toEqual([...backend].sort());
  });
});
