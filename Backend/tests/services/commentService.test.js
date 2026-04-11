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
    it('should return comments for an issue sorted by createdAt', async () => {
      const mockComments = [{ _id: '1', content: 'Hello' }];
      Comment.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockComments),
        }),
      });

      const result = await commentService.getComments('issue1');

      expect(result).toHaveLength(1);
      expect(Comment.find).toHaveBeenCalledWith({ issueId: 'issue1' });
    });
  });

  describe('addComment()', () => {
    it('should throw if content is empty', async () => {
      await expect(
        commentService.addComment('issue1', { content: '', user: { id: 'user1', role: 'user' } })
      ).rejects.toThrow('Content is required');
    });

    it('should throw if content is only whitespace', async () => {
      await expect(
        commentService.addComment('issue1', { content: '   ', user: { id: 'user1', role: 'user' } })
      ).rejects.toThrow('Content is required');
    });

    it('should throw if issue not found', async () => {
      Issue.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        commentService.addComment('nonexistent', { content: 'test', user: { id: 'user1', role: 'user' } })
      ).rejects.toThrow('Issue not found');
    });

    it('should create comment and notify admins when user comments', async () => {
      Issue.findById.mockReturnValue({
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

    it('should create comment and notify reporter when admin comments', async () => {
      Issue.findById.mockReturnValue({
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
  });
});
