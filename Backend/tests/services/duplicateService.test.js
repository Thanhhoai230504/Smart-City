jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');

const Issue = require('../../src/models/Issue');
const Notification = require('../../src/models/Notification');
const { getIO } = require('../../src/config/socket');
const duplicateService = require('../../src/services/duplicateService');

const mockIO = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

describe('DuplicateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    Notification.create.mockImplementation(async (data) => ({ _id: 'notification1', ...data }));
  });

  describe('confirmDuplicate()', () => {
    it('should add the user as a voter and follower only once', async () => {
      const issue = {
        _id: 'issue1',
        votes: [],
        followers: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Issue.findOne.mockResolvedValue(issue);

      const result = await duplicateService.confirmDuplicate('issue1', 'user1');

      expect(Issue.findOne).toHaveBeenCalledWith({
        _id: 'issue1',
        isDeleted: false,
        mergedInto: null,
        status: { $in: ['reported', 'processing'] },
      });
      expect(issue.votes).toEqual(['user1']);
      expect(issue.followers).toEqual(['user1']);
      expect(issue.voteCount).toBe(1);
      expect(result.alreadyConfirmed).toBe(false);
    });

    it('should be idempotent when the user already confirmed', async () => {
      const issue = {
        _id: 'issue1',
        votes: ['user1'],
        followers: ['user1'],
        save: jest.fn().mockResolvedValue(true),
      };
      Issue.findOne.mockResolvedValue(issue);

      const result = await duplicateService.confirmDuplicate('issue1', 'user1');

      expect(issue.votes).toEqual(['user1']);
      expect(issue.followers).toEqual(['user1']);
      expect(issue.voteCount).toBe(1);
      expect(result.alreadyConfirmed).toBe(true);
    });
  });

  describe('mergeIssue()', () => {
    it('should merge unique votes, followers and duplicate count into the target', async () => {
      const source = {
        _id: 'source1',
        title: 'Bản trùng',
        userId: 'reporter2',
        votes: ['voter2', 'shared'],
        followers: ['follower2'],
        duplicateCount: 2,
        mergedInto: null,
        save: jest.fn().mockResolvedValue(true),
      };
      const target = {
        _id: 'target1',
        title: 'Bản gốc',
        userId: 'reporter1',
        votes: ['voter1', 'shared'],
        followers: ['follower1'],
        duplicateCount: 1,
        mergedInto: null,
        save: jest.fn().mockResolvedValue(true),
      };
      Issue.findOne
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(target);

      const result = await duplicateService.mergeIssue(
        'source1',
        'target1',
        { id: 'admin1' }
      );

      expect(target.votes.map(String)).toEqual(['voter1', 'shared', 'voter2']);
      expect(target.followers.map(String)).toEqual([
        'reporter1',
        'follower1',
        'reporter2',
        'follower2',
        'voter2',
        'shared',
      ]);
      expect(target.voteCount).toBe(3);
      expect(target.duplicateCount).toBe(4);
      expect(source.mergedInto).toBe('target1');
      expect(source.mergedAt).toBeInstanceOf(Date);
      expect(source.mergedBy).toBe('admin1');
      expect(source.save).toHaveBeenCalled();
      expect(target.save).toHaveBeenCalled();
      expect(result.targetIssue).toBe(target);
      expect(Notification.create).toHaveBeenCalled();
    });

    it('should reject merging an issue into itself', async () => {
      await expect(
        duplicateService.mergeIssue('same', 'same', { id: 'admin1' })
      ).rejects.toThrow('chính nó');

      expect(Issue.findOne).not.toHaveBeenCalled();
    });

    it('should reject a source that was already merged', async () => {
      Issue.findOne
        .mockResolvedValueOnce({ _id: 'source1', mergedInto: 'other' })
        .mockResolvedValueOnce({ _id: 'target1', mergedInto: null });

      await expect(
        duplicateService.mergeIssue('source1', 'target1', { id: 'admin1' })
      ).rejects.toThrow('đã được gộp');
    });
  });
});
