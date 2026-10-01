const { buildMeta } = require('../../src/utils/metaConfig');
const { ISSUE_CATEGORIES } = require('../../src/utils/slaConfig');
const { ALLOWED_TRANSITIONS } = require('../../src/utils/issueStatusConfig');
const Issue = require('../../src/models/Issue');
const Notification = require('../../src/models/Notification');

/**
 * Điểm của endpoint này là app mobile KHÔNG hardcode taxonomy. Các test dưới đây
 * canh đúng một rủi ro: backend thêm/đổi enum mà quên cập nhật meta, khiến app đã
 * phát hành hiện sai nhãn hoặc thiếu lựa chọn — mà app thì phải chờ duyệt store
 * mới sửa được.
 */
describe('metaConfig.buildMeta', () => {
  const meta = buildMeta();

  it('exposes a version so clients can cache and revalidate', () => {
    expect(typeof meta.version).toBe('string');
    expect(meta.version.length).toBeGreaterThan(0);
  });

  describe('categories', () => {
    it('covers exactly the categories the model accepts', () => {
      expect(meta.categories.map((c) => c.value).sort()).toEqual([...ISSUE_CATEGORIES].sort());
    });

    it('matches the Issue model enum, not a hand-kept list', () => {
      const modelEnum = Issue.schema.path('category').enumValues;
      expect(meta.categories.map((c) => c.value).sort()).toEqual([...modelEnum].sort());
    });

    it('gives every category a label, icon and both SLA clocks', () => {
      for (const c of meta.categories) {
        expect(c.label).toBeTruthy();
        expect(c.icon).toBeTruthy();
        expect(c.slaHours).toBeGreaterThan(0);
        expect(c.intakeHours).toBeGreaterThan(0);
      }
    });
  });

  describe('statuses', () => {
    it('covers exactly the statuses the model accepts', () => {
      const modelEnum = Issue.schema.path('status').enumValues;
      expect(meta.statuses.map((s) => s.value).sort()).toEqual([...modelEnum].sort());
    });

    // Bảng màu cũ ở frontend không đạt WCAG AA khi dùng làm chữ trên nền trắng
    // (processing #F59E0B chỉ 2.15:1). Bảng này đã đo lại — giữ cặp text/nền
    // tường minh thay vì tô alpha, vì alpha cho kết quả không dự đoán được.
    it('ships a text colour and a solid container colour for each status', () => {
      for (const s of meta.statuses) {
        expect(s.color).toMatch(/^#[0-9A-F]{6}$/i);
        expect(s.container).toMatch(/^#[0-9A-F]{6}$/i);
      }
    });
  });

  describe('statusTransitions', () => {
    // Đây là thứ xoá bản sao bảng luật ở Frontend/src/utils/constants.ts.
    it('mirrors the server-side state machine exactly', () => {
      expect(meta.statusTransitions).toEqual(ALLOWED_TRANSITIONS);
    });

    it('never offers reported as a destination', () => {
      for (const targets of Object.values(meta.statusTransitions)) {
        expect(targets).not.toContain('reported');
      }
    });
  });

  describe('notificationTypes', () => {
    // Union ở frontend đã từng lệch backend (thiếu issue_assigned, sla_reminder,
    // sla_escalated, issue_merged). Test này chặn việc đó tái diễn.
    it('covers every type the Notification model accepts', () => {
      const modelEnum = Notification.schema.path('type').enumValues;
      expect(meta.notificationTypes.map((t) => t.value).sort()).toEqual([...modelEnum].sort());
    });

    it('labels every type in Vietnamese', () => {
      for (const t of meta.notificationTypes) expect(t.label).toBeTruthy();
    });
  });

  describe('limits', () => {
    it('takes the image cap from the model instead of restating it', () => {
      expect(meta.limits.maxImages).toBe(Issue.MAX_ISSUE_IMAGES);
    });

    it('matches the server-side note length limit', () => {
      const notePath = Issue.schema.path('statusHistory').schema.path('note');
      expect(meta.limits.maxNoteLength).toBe(notePath.options.maxlength[0]);
    });
  });

  describe('reopen', () => {
    it('publishes the guard rails so the client can hide the button early', () => {
      expect(meta.reopen.maxCount).toBeGreaterThan(0);
      expect(meta.reopen.windowDays).toBeGreaterThan(0);
      expect(meta.reopen.minReasonLength).toBeGreaterThanOrEqual(10);
    });
  });

  describe('areas', () => {
    it('includes the fallback bucket so unmapped issues are still displayable', () => {
      expect(meta.areas.map((a) => a.value)).toContain('Khác');
    });
  });

  it('is pure data — safe to cache and serve without a database', () => {
    expect(JSON.stringify(buildMeta())).toBe(JSON.stringify(meta));
  });
});
