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

/** Mock Mongoose Query: .select() trả về chính nó, await ra `result`. */
const mockQuery = (result) => {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ['select', 'populate', 'lean']) q[m] = jest.fn(() => q);
  return q;
};

const OPEN = { isDeleted: false, mergedInto: null, status: { $in: ['reported', 'processing'] } };

describe('DuplicateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    Notification.create.mockImplementation(async (data) => ({ _id: 'notification1', ...data }));
  });

  describe('confirmDuplicate()', () => {
    // Một lệnh ghi có điều kiện thay cho đọc → sửa mảng → save: bấm đúp không
    // thể thêm cùng một người hai lần hay làm voteCount lệch số người thật.
    it('adds the vote and follow in ONE conditional write', async () => {
      Issue.findOneAndUpdate.mockReturnValueOnce(mockQuery({ _id: 'issue1', voteCount: 1 }));

      const result = await duplicateService.confirmDuplicate('issue1', 'user1');

      expect(Issue.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(Issue.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'issue1', ...OPEN, votes: { $ne: 'user1' } },
        { $addToSet: { votes: 'user1', followers: 'user1' }, $inc: { voteCount: 1 } },
        { new: true }
      );
      expect(result).toEqual({ issueId: 'issue1', voteCount: 1, alreadyConfirmed: false });
    });

    it('is idempotent when the user already confirmed (no second vote, still following)', async () => {
      Issue.findOneAndUpdate
        .mockReturnValueOnce(mockQuery(null))
        .mockReturnValueOnce(mockQuery({ _id: 'issue1', voteCount: 1 }));

      const result = await duplicateService.confirmDuplicate('issue1', 'user1');

      expect(Issue.findOneAndUpdate).toHaveBeenLastCalledWith(
        { _id: 'issue1', ...OPEN },
        { $addToSet: { followers: 'user1' } },
        { new: true }
      );
      expect(result).toEqual({ issueId: 'issue1', voteCount: 1, alreadyConfirmed: true });
    });

    it('404 when the issue is no longer open', async () => {
      Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));

      await expect(duplicateService.confirmDuplicate('issue1', 'user1')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('mergeIssue()', () => {
    const openSource = (overrides = {}) => ({
      _id: 'source1',
      title: 'Bản trùng',
      userId: 'reporter2',
      status: 'reported',
      votes: ['voter2', 'shared'],
      followers: ['follower2'],
      duplicateCount: 2,
      mergedInto: null,
      ...overrides,
    });
    const openTarget = (overrides = {}) => ({
      _id: 'target1',
      title: 'Bản gốc',
      userId: 'reporter1',
      status: 'processing',
      votes: ['voter1', 'shared'],
      followers: ['follower1'],
      duplicateCount: 1,
      mergedInto: null,
      ...overrides,
    });

    it('claims the source, then folds votes/followers/duplicateCount into the target', async () => {
      const source = openSource();
      const target = openTarget();
      Issue.findOne.mockResolvedValueOnce(source).mockResolvedValueOnce(target);
      Issue.findOneAndUpdate
        .mockResolvedValueOnce({ ...source, mergedInto: 'target1' })
        .mockResolvedValueOnce({ ...target, votes: ['voter1', 'shared', 'voter2'], duplicateCount: 4 });
      Issue.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await duplicateService.mergeIssue('source1', 'target1', { id: 'admin1' });

      // (1) Phiếu phụ chỉ được "nhận" khi còn mở và chưa gộp.
      const [claimFilter, claimUpdate] = Issue.findOneAndUpdate.mock.calls[0];
      expect(claimFilter).toEqual({ _id: 'source1', ...OPEN });
      expect(claimUpdate.$set).toMatchObject({ mergedInto: 'target1', mergedBy: 'admin1' });
      expect(claimUpdate.$set.mergedAt).toBeInstanceOf(Date);

      // (2) Phiếu gốc chỉ nhận khi còn mở và chưa gộp; $addToSet nên không trùng người.
      const [targetFilter, targetUpdate] = Issue.findOneAndUpdate.mock.calls[1];
      expect(targetFilter).toEqual({ _id: 'target1', ...OPEN });
      expect(targetUpdate.$addToSet.votes.$each.map(String)).toEqual(['voter2', 'shared']);
      expect(targetUpdate.$addToSet.followers.$each.map(String)).toEqual([
        'reporter1', 'reporter2', 'follower2', 'voter2', 'shared',
      ]);
      expect(targetUpdate.$inc).toEqual({ duplicateCount: 3 });

      // voteCount tính lại từ chính mảng votes (update pipeline).
      expect(Issue.updateOne).toHaveBeenCalledWith({ _id: 'target1' }, [{ $set: { voteCount: { $size: '$votes' } } }]);
      expect(result.targetIssue.voteCount).toBe(3);
      expect(Notification.create).toHaveBeenCalled();
    });

    it('rolls the source back and returns 409 when the target changed in between', async () => {
      Issue.findOne.mockResolvedValueOnce(openSource()).mockResolvedValueOnce(openTarget());
      Issue.findOneAndUpdate
        .mockResolvedValueOnce({ ...openSource(), mergedInto: 'target1' })
        .mockResolvedValueOnce(null);
      Issue.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await expect(
        duplicateService.mergeIssue('source1', 'target1', { id: 'admin1' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'MERGE_CONFLICT' });

      expect(Issue.updateOne).toHaveBeenCalledWith(
        { _id: 'source1', mergedInto: 'target1' },
        { $set: { mergedInto: null, mergedAt: null, mergedBy: null } }
      );
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it('409 without touching the target when the source was claimed by another merge', async () => {
      Issue.findOne.mockResolvedValueOnce(openSource()).mockResolvedValueOnce(openTarget());
      Issue.findOneAndUpdate.mockResolvedValueOnce(null);

      await expect(
        duplicateService.mergeIssue('source1', 'target1', { id: 'admin1' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'MERGE_CONFLICT' });
      expect(Issue.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    // Gộp báo cáo mới vào phiếu đã đóng thì báo cáo đó không bao giờ được xử lý.
    it.each([
      ['MERGE_TARGET_CLOSED', openSource(), openTarget({ status: 'resolved' })],
      ['MERGE_TARGET_CLOSED', openSource(), openTarget({ status: 'rejected' })],
      ['MERGE_SOURCE_CLOSED', openSource({ status: 'resolved' }), openTarget()],
    ])('refuses with 400 %s', async (code, source, target) => {
      Issue.findOne.mockResolvedValueOnce(source).mockResolvedValueOnce(target);

      await expect(
        duplicateService.mergeIssue('source1', 'target1', { id: 'admin1' })
      ).rejects.toMatchObject({ statusCode: 400, code });
      expect(Issue.findOneAndUpdate).not.toHaveBeenCalled();
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
