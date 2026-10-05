jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');
jest.mock('../../src/services/priorityService');

const Issue = require('../../src/models/Issue');
const User = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const { getIO } = require('../../src/config/socket');
const { enqueuePriorityRecalculation } = require('../../src/services/priorityService');
const reopenService = require('../../src/services/reopenService');

const mockIO = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
const DAY = 24 * 60 * 60 * 1000;

/** Mock Mongoose Query: .populate() trả về chính nó, await ra `result`. */
const mockQuery = (result) => {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ['populate', 'select', 'lean']) q[m] = jest.fn(() => q);
  return q;
};

const closedIssue = (overrides = {}) => ({
  _id: 'i1',
  title: 'Ổ gà',
  category: 'pothole',
  userId: { _id: 'reporter1' },
  status: 'resolved',
  resolvedAt: new Date(Date.now() - 2 * DAY),
  reopenCount: 0,
  mergedInto: null,
  departmentId: null,
  assigneeId: null,
  dueAt: new Date(Date.now() - 5 * DAY),
  escalationLevel: 2,
  lastReminderAt: new Date(Date.now() - 3 * DAY),
  statusHistory: [{ status: 'resolved', changedAt: new Date(Date.now() - 2 * DAY) }],
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('reopenService.reopenIssue (G8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    Notification.create.mockResolvedValue({ _id: 'n1' });
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'admin1' }]) });
  });

  /**
   * Lệnh ghi có điều kiện: trả về bản "sau khi mở lại" dựng từ phiếu gốc + update,
   * đủ để service gửi thông báo đúng người. Trả `null` để giả lập request khác ghi trước.
   */
  const mockReopenWrite = (issue, { lost = false } = {}) => {
    Issue.findOneAndUpdate.mockImplementation((filter, update) => mockQuery(lost ? null : {
      ...issue,
      ...update.$set,
      reopenCount: (issue.reopenCount || 0) + update.$inc.reopenCount,
    }));
  };
  const lastWrite = () => {
    const [filter, update, options] = Issue.findOneAndUpdate.mock.calls.at(-1);
    return { filter, update, options };
  };

  it('puts the issue back into processing and records who asked', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Ổ gà vẫn còn nguyên' });

    const { update } = lastWrite();
    expect(update.$set.status).toBe('processing');
    expect(update.$inc).toEqual({ reopenCount: 1 });
    expect(update.$set.lastReopenedAt).toBeInstanceOf(Date);
    expect(update.$push.statusHistory).toMatchObject({ status: 'processing', changedBy: 'reporter1' });
    expect(update.$push.statusHistory.note).toContain('Ổ gà vẫn còn nguyên');
  });

  // Bấm "Mở lại" hai lần cùng lúc: chỉ một lần được ghi — lệnh ghi kèm đúng trạng
  // thái đóng và số lần mở lại vừa kiểm tra.
  it('writes only if the issue is still closed with the same reopen count', async () => {
    const issue = closedIssue({ reopenCount: 1 });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Vẫn chưa xong' });

    expect(lastWrite().filter).toEqual({
      _id: 'i1', isDeleted: false, mergedInto: null, status: 'resolved', reopenCount: 1,
    });
  });

  it('a first reopen also matches old issues that never had a reopenCount field', async () => {
    const issue = closedIssue({ reopenCount: undefined });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Vẫn chưa xong' });

    expect(lastWrite().filter.reopenCount).toEqual({ $in: [0, null] });
  });

  it('returns 409 STATUS_CONFLICT and notifies nobody when another request wrote first', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue, { lost: true });

    await expect(
      reopenService.reopenIssue('i1', 'reporter1', { reason: 'Vẫn chưa xong' })
    ).rejects.toMatchObject({ statusCode: 409, code: 'STATUS_CONFLICT' });
    expect(Notification.create).not.toHaveBeenCalled();
  });

  // Để nguyên resolvedAt sẽ làm sai thống kê thời gian xử lý trung bình.
  it('clears resolvedAt so resolution-time stats stay correct', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Vẫn chưa xong' });

    expect(lastWrite().update.$set.resolvedAt).toBeNull();
  });

  // Lượt mới: không cho báo xong lại bằng chính ảnh người dân vừa khiếu nại, và
  // người dân được đánh giá lại kết quả lượt mới.
  it('archives the previous round and clears evidence + rating', async () => {
    const ratedAt = new Date(Date.now() - DAY);
    const issue = closedIssue({
      resolutionImages: [{ url: 'https://cloud/after.jpg', publicId: 'p1', uploadedBy: 'staff1', uploadedAt: ratedAt }],
      rating: { score: 1, comment: 'Chưa sửa gì cả', ratedAt },
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Ổ gà vẫn còn nguyên' });

    const { update } = lastWrite();
    expect(update.$set).toMatchObject({
      resolutionImages: [],
      rating: { score: null, comment: null, ratedAt: null },
    });
    expect(update.$push.previousRounds).toMatchObject({
      closedStatus: 'resolved',
      closedAt: issue.resolvedAt,
      resolutionImages: [{ url: 'https://cloud/after.jpg', publicId: 'p1' }],
      rating: { score: 1, comment: 'Chưa sửa gì cả' },
      reopenedBy: 'reporter1',
      reopenReason: 'Ổ gà vẫn còn nguyên',
    });
  });

  it('a rejected issue keeps the rejection time as the round close time', async () => {
    const rejectedAt = new Date(Date.now() - 3 * DAY);
    const issue = closedIssue({
      status: 'rejected',
      resolvedAt: null,
      statusHistory: [{ status: 'reported', changedAt: new Date(Date.now() - 4 * DAY) }, { status: 'rejected', changedAt: rejectedAt }],
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Từ chối không có căn cứ' });

    expect(lastWrite().update.$push.previousRounds).toMatchObject({ closedStatus: 'rejected', closedAt: rejectedAt });
  });

  // Giữ dueAt cũ thì phiếu lập tức quá hạn mà cron KHÔNG nhắc nữa, vì
  // escalationLevel đã ở mức cuối — đơn vị nhận lại việc mà không có hạn thật.
  it('gives the department a fresh SLA cycle when one is assigned', async () => {
    const issue = closedIssue({
      departmentId: { _id: 'd1', name: 'Đội hạ tầng', slaHours: null },
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    const { $set } = lastWrite().update;
    expect($set.dueAt.getTime()).toBeGreaterThan(Date.now());
    expect($set.escalationLevel).toBe(0);
    expect($set.lastReminderAt).toBeNull();
  });

  it('does not invent a deadline for an unassigned issue', async () => {
    const issue = closedIssue({ departmentId: null, dueAt: null });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    expect(lastWrite().update.$set).not.toHaveProperty('dueAt');
  });

  it('notifies the assignee and every admin', async () => {
    const issue = closedIssue({
      departmentId: { _id: 'd1', name: 'Đội hạ tầng', slaHours: null },
      assigneeId: 'staff1',
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    const notified = Notification.create.mock.calls.map(([d]) => String(d.userId));
    expect(notified).toContain('staff1');
    expect(notified).toContain('admin1');
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'issue_reopened', message: expect.stringContaining('lần 1') })
    );
  });

  it('falls back to the whole department when nobody claimed the issue', async () => {
    const issue = closedIssue({
      departmentId: { _id: 'd1', name: 'Đội hạ tầng', slaHours: null },
      assigneeId: null,
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);
    User.find
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([{ _id: 'staffA' }, { _id: 'staffB' }]) })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([{ _id: 'admin1' }]) });

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    const notified = Notification.create.mock.calls.map(([d]) => String(d.userId));
    expect(notified).toEqual(expect.arrayContaining(['staffA', 'staffB', 'admin1']));
  });

  it('queues a priority recalculation', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    expect(enqueuePriorityRecalculation).toHaveBeenCalledWith('i1');
  });

  it('survives a notification failure without losing the reopen', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    mockReopenWrite(issue);
    Notification.create.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' })
    ).resolves.toBeTruthy();
    expect(Issue.findOneAndUpdate).toHaveBeenCalled();
    console.warn.mockRestore();
  });

  describe('rào chắn', () => {
    it('refuses a non-reporter with 403 and a code', async () => {
      Issue.findOne.mockReturnValue(mockQuery(closedIssue()));

      await expect(
        reopenService.reopenIssue('i1', 'intruder', { reason: 'Tôi muốn mở lại' })
      ).rejects.toMatchObject({ statusCode: 403, code: 'NOT_REPORTER' });
    });

    it.each([
      ['ISSUE_NOT_CLOSED', { status: 'processing' }],
      ['REOPEN_LIMIT_REACHED', { reopenCount: 2 }],
      ['MERGED_ISSUE', { mergedInto: 'other1' }],
    ])('refuses with 400 %s', async (code, overrides) => {
      Issue.findOne.mockReturnValue(mockQuery(closedIssue(overrides)));

      await expect(
        reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' })
      ).rejects.toMatchObject({ statusCode: 400, code });
    });

    it('refuses a missing issue with 404', async () => {
      Issue.findOne.mockReturnValue(mockQuery(null));

      await expect(
        reopenService.reopenIssue('nope', 'reporter1', { reason: 'Chưa xử lý thật' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('does not write anything when a guard refuses', async () => {
      const issue = closedIssue({ reopenCount: 2 });
      Issue.findOne.mockReturnValue(mockQuery(issue));

      await expect(
        reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' })
      ).rejects.toThrow();

      expect(Issue.findOneAndUpdate).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });
  });
});
