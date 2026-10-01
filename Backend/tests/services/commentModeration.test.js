jest.mock('../../src/models/Comment');
jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');

const Comment = require('../../src/models/Comment');
const commentService = require('../../src/services/commentService');
const commentRouter = require('../../src/routes/comments');
const AuditLog = require('../../src/models/AuditLog');

const hiddenFields = (c) => ({
  isDeleted: c.isDeleted, deletedBy: c.deletedBy, deletedReason: c.deletedReason,
});

const aComment = (overrides = {}) => ({
  _id: 'c1',
  issueId: 'i1',
  content: 'noi dung',
  isDeleted: false,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

// Trước đây model KHÔNG có isDeleted và routes chỉ có GET + POST — một bình luận
// xúc phạm hay lộ thông tin cá nhân KHÔNG thể gỡ bằng bất kỳ cách nào ngoài sửa
// trực tiếp database.
describe('G16 — kiểm duyệt bình luận', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('hideComment', () => {
    it('hides the comment and records who did it and why', async () => {
      const comment = aComment();
      Comment.findById.mockResolvedValue(comment);

      await commentService.hideComment('c1', { reason: 'Xúc phạm', actor: { id: 'admin1' } });

      expect(hiddenFields(comment)).toEqual({
        isDeleted: true, deletedBy: 'admin1', deletedReason: 'Xúc phạm',
      });
      expect(comment.deletedAt).toBeInstanceOf(Date);
      expect(comment.save).toHaveBeenCalled();
    });

    // Ẩn chứ không xoá cứng: giữ nội dung gốc để truy vết nếu có khiếu nại về
    // chính quyết định kiểm duyệt.
    it('keeps the original content instead of deleting the row', async () => {
      const comment = aComment();
      Comment.findById.mockResolvedValue(comment);

      await commentService.hideComment('c1', { reason: 'x', actor: { id: 'admin1' } });

      expect(comment.content).toBe('noi dung');
      expect(Comment.deleteOne).not.toHaveBeenCalled();
      expect(Comment.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('accepts a missing reason', async () => {
      const comment = aComment();
      Comment.findById.mockResolvedValue(comment);

      await commentService.hideComment('c1', { actor: { id: 'admin1' } });

      expect(comment.deletedReason).toBeNull();
    });

    it('refuses to hide the same comment twice', async () => {
      Comment.findById.mockResolvedValue(aComment({ isDeleted: true }));

      await expect(commentService.hideComment('c1', { actor: { id: 'admin1' } }))
        .rejects.toMatchObject({ code: 'COMMENT_ALREADY_HIDDEN' });
    });

    it('raises 404 for a missing comment', async () => {
      Comment.findById.mockResolvedValue(null);

      await expect(commentService.hideComment('nope', { actor: { id: 'admin1' } }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('restoreComment', () => {
    it('clears every moderation field so an accident is fully undone', async () => {
      const comment = aComment({
        isDeleted: true, deletedAt: new Date(), deletedBy: 'admin1', deletedReason: 'nham',
      });
      Comment.findById.mockResolvedValue(comment);

      await commentService.restoreComment('c1');

      expect(hiddenFields(comment)).toEqual({
        isDeleted: false, deletedBy: null, deletedReason: null,
      });
      expect(comment.deletedAt).toBeNull();
    });
  });

  describe('routes', () => {
    const getRoute = (p, method) => commentRouter.stack.find(
      (l) => l.route?.path === p && l.route.methods[method]
    );

    // Cán bộ không được tự gỡ phản ánh về đơn vị của mình — xung đột lợi ích.
    it('restricts hiding to admins only', () => {
      const names = getRoute('/:commentId', 'delete').route.stack.map((l) => l.handle.name);
      expect(names).toContain('authMiddleware');
      expect(names).toContain('adminMiddleware');
    });

    it('restricts restoring to admins only', () => {
      const names = getRoute('/:commentId/restore', 'post').route.stack.map((l) => l.handle.name);
      expect(names).toContain('adminMiddleware');
    });

    it('validates the reason length', () => {
      const names = getRoute('/:commentId', 'delete').route.stack.map((l) => l.handle.name);
      expect(names).toContain('validate');
    });
  });

  describe('audit', () => {
    // recordAudit sẽ fail validation nếu action hoặc entityType chưa khai báo.
    it.each(['comment.hidden', 'comment.restored'])('declares the %s action', (action) => {
      expect(AuditLog.schema.path('action').enumValues).toContain(action);
    });

    it('declares Comment as an auditable entity type', () => {
      expect(AuditLog.schema.path('entityType').enumValues).toContain('Comment');
    });
  });
});
