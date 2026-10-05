jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Comment');
jest.mock('../../src/models/Notification');
jest.mock('../../src/models/User');
jest.mock('../../src/config/socket');

const Comment = require('../../src/models/Comment');
const Issue = require('../../src/models/Issue');
const Notification = require('../../src/models/Notification');
const User = require('../../src/models/User');
const { getIO } = require('../../src/config/socket');
const commentService = require('../../src/services/commentService');

const mockIO = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

describe('CommentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
  });

  describe('getComments()', () => {
    const mockFindChain = (comments) => {
      const populate = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(comments),
          }),
        }),
      });
      Comment.find.mockReturnValue({ populate });
      return populate;
    };

    it('should return comments for an issue sorted by createdAt', async () => {
      Issue.exists.mockResolvedValue({ _id: 'issue1' });
      mockFindChain([{ _id: '1', content: 'Hello' }]);
      Comment.countDocuments.mockResolvedValue(1);

      const result = await commentService.getComments('issue1');

      expect(result.comments).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      // G16: bình luận đã ẩn không ra khỏi server nữa.
      expect(Comment.find).toHaveBeenCalledWith({ issueId: 'issue1', isDeleted: false });
    });

    it('route công khai: người viết chỉ lộ tên + vai trò, KHÔNG có email', async () => {
      Issue.exists.mockResolvedValue({ _id: 'issue1' });
      const populate = mockFindChain([]);
      Comment.countDocuments.mockResolvedValue(0);

      await commentService.getComments('issue1');

      expect(populate).toHaveBeenCalledWith('userId', 'name role');
      expect(populate.mock.calls[0][1]).not.toMatch(/email/);
    });

    it('sự cố đã xoá mềm thì không trả bình luận nữa (404)', async () => {
      Issue.exists.mockResolvedValue(null);

      await expect(commentService.getComments('deleted-issue')).rejects.toMatchObject({ statusCode: 404 });
      expect(Issue.exists).toHaveBeenCalledWith({ _id: 'deleted-issue', isDeleted: false });
      expect(Comment.find).not.toHaveBeenCalled();
    });
  });

  describe('addComment()', () => {
    it('should throw if content is empty', async () => {
      await expect(
        commentService.addComment('issue1', { content: '', user: { id: 'user1', role: 'user' } })
      ).rejects.toThrow('Vui lòng nhập nội dung bình luận.');
    });

    it('should throw if content is only whitespace', async () => {
      await expect(
        commentService.addComment('issue1', { content: '   ', user: { id: 'user1', role: 'user' } })
      ).rejects.toThrow('Vui lòng nhập nội dung bình luận.');
    });

    it('should throw if issue not found', async () => {
      Issue.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        commentService.addComment('nonexistent', { content: 'test', user: { id: 'user1', role: 'user' } })
      ).rejects.toThrow('Không tìm thấy sự cố.');
    });

    it('should create comment and notify admins when user comments', async () => {
      Issue.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'issue1',
          title: 'Pothole',
          userId: { _id: 'reporter1' },
        }),
      });
      const mockComment = {
        _id: 'comment1',
        content: 'test',
        populate: jest.fn().mockResolvedValue(true),
      };
      Comment.create.mockResolvedValue(mockComment);
      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: 'admin1' }]),
      });
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      const result = await commentService.addComment('issue1', {
        content: 'Need update',
        user: { id: 'user1', name: 'Citizen', role: 'user' },
      });

      expect(Comment.create).toHaveBeenCalled();
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'comment', userId: 'admin1' })
      );
    });

    describe('người dân bình luận → báo cả người đang xử lý', () => {
      const mockUsers = ({ staff, admins }) => {
        User.find.mockImplementation((query) => ({
          select: jest.fn().mockResolvedValue(query.role === 'staff' ? staff : admins),
        }));
      };
      const comment = () => {
        Comment.create.mockResolvedValue({ _id: 'c1', populate: jest.fn().mockResolvedValue(true) });
        Notification.create.mockImplementation(async (doc) => ({ _id: `n-${doc.userId}`, ...doc }));
        return commentService.addComment('issue1', {
          content: 'Ổ gà đang to ra',
          user: { id: 'citizen1', name: 'Dân', role: 'user' },
        });
      };

      it('cán bộ đang giữ phiếu nhận thông báo realtime, cùng với admin', async () => {
        Issue.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: 'issue1', title: 'Pothole', userId: { _id: 'citizen1' },
            departmentId: 'dept1', assigneeId: 'staff1',
          }),
        });
        mockUsers({ staff: [{ _id: 'staff1' }, { _id: 'staff2' }], admins: [{ _id: 'admin1' }] });

        await comment();

        const recipients = Notification.create.mock.calls.map(([doc]) => doc.userId.toString());
        expect(recipients).toEqual(['staff1', 'admin1']);
        expect(Notification.create).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 'staff1', title: 'Người dân phản hồi phiếu bạn xử lý' })
        );
        expect(mockIO.to).toHaveBeenCalledWith('user_staff1');
        expect(mockIO.emit).toHaveBeenCalledWith('notification:new', expect.objectContaining({ userId: 'staff1' }));
      });

      it('phiếu chưa ai nhận → báo cả cán bộ của đơn vị', async () => {
        Issue.findOne.mockReturnValue({
          populate: jest.fn().mockResolvedValue({
            _id: 'issue1', title: 'Pothole', userId: { _id: 'citizen1' },
            departmentId: 'dept1', assigneeId: null,
          }),
        });
        mockUsers({ staff: [{ _id: 'staff1' }, { _id: 'staff2' }], admins: [{ _id: 'admin1' }] });

        await comment();

        expect(User.find).toHaveBeenCalledWith({ departmentId: 'dept1', role: 'staff', isActive: true });
        const recipients = Notification.create.mock.calls.map(([doc]) => doc.userId.toString());
        expect(recipients).toEqual(['staff1', 'staff2', 'admin1']);
      });
    });

    it('should create comment and notify reporter when admin comments', async () => {
      Issue.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'issue1',
          title: 'Pothole',
          userId: { _id: 'reporter1' },
        }),
      });
      const mockComment = {
        _id: 'comment1',
        content: 'test',
        populate: jest.fn().mockResolvedValue(true),
      };
      Comment.create.mockResolvedValue(mockComment);
      Notification.create.mockResolvedValue({ _id: 'notif1' });

      await commentService.addComment('issue1', {
        content: 'We are on it',
        user: { id: 'admin1', name: 'Admin', role: 'admin' },
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'reporter1', type: 'comment' })
      );
      expect(mockIO.to).toHaveBeenCalledWith('user_reporter1');
    });

    // ─── E1: vai 'staff' trước đây rơi vào CẢ HAI nhánh sai ───
    // `isAdmin = user.role === 'admin'` khiến cán bộ (a) không được coi là người
    // xử lý nên người dân KHÔNG nhận thông báo, và (b) bị nhánh `!isAdmin` gộp
    // vào "người dân" nên admin nhận thông báo ghi sai nguồn.
    const mockIssueWithReporter = (reporterId = 'reporter1') => {
      Issue.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: 'issue1',
          title: 'Pothole',
          userId: { _id: reporterId },
        }),
      });
      Comment.create.mockResolvedValue({ _id: 'c1', populate: jest.fn().mockResolvedValue(true) });
      Notification.create.mockResolvedValue({ _id: 'notif1' });
      User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'admin1' }]) });
    };

    it('should notify the reporter when a staff member comments', async () => {
      mockIssueWithReporter();

      await commentService.addComment('issue1', {
        content: 'Đội đang xuống hiện trường',
        user: { id: 'staff1', name: 'Cán bộ A', role: 'staff', departmentId: 'd1' },
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'reporter1', type: 'comment' })
      );
      expect(mockIO.to).toHaveBeenCalledWith('user_reporter1');
    });

    it('should not mislabel a staff comment as coming from a citizen', async () => {
      mockIssueWithReporter();

      await commentService.addComment('issue1', {
        content: 'Đội đang xuống hiện trường',
        user: { id: 'staff1', name: 'Cán bộ A', role: 'staff', departmentId: 'd1' },
      });

      const sentToAdmins = Notification.create.mock.calls.filter(
        ([doc]) => String(doc.userId) === 'admin1'
      );
      expect(sentToAdmins).toHaveLength(0);
    });

    it('should not notify the reporter when the reporter comments on their own issue', async () => {
      mockIssueWithReporter('admin1');

      await commentService.addComment('issue1', {
        content: 'Tự ghi chú',
        user: { id: 'admin1', name: 'Admin', role: 'admin' },
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });
  });
});
