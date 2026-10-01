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

  it('puts the issue back into processing and records who asked', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Ổ gà vẫn còn nguyên' });

    expect(issue.status).toBe('processing');
    expect(issue.reopenCount).toBe(1);
    expect(issue.lastReopenedAt).toBeInstanceOf(Date);
    expect(issue.save).toHaveBeenCalled();
    const entry = issue.statusHistory[issue.statusHistory.length - 1];
    expect(entry).toMatchObject({ status: 'processing', changedBy: 'reporter1' });
    expect(entry.note).toContain('Ổ gà vẫn còn nguyên');
  });

  // Để nguyên resolvedAt sẽ làm sai thống kê thời gian xử lý trung bình.
  it('clears resolvedAt so resolution-time stats stay correct', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Vẫn chưa xong' });

    expect(issue.resolvedAt).toBeNull();
  });

  // Giữ dueAt cũ thì phiếu lập tức quá hạn mà cron KHÔNG nhắc nữa, vì
  // escalationLevel đã ở mức cuối — đơn vị nhận lại việc mà không có hạn thật.
  it('gives the department a fresh SLA cycle when one is assigned', async () => {
    const issue = closedIssue({
      departmentId: { _id: 'd1', name: 'Đội hạ tầng', slaHours: null },
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    expect(issue.dueAt.getTime()).toBeGreaterThan(Date.now());
    expect(issue.escalationLevel).toBe(0);
    expect(issue.lastReminderAt).toBeNull();
  });

  it('does not invent a deadline for an unassigned issue', async () => {
    const issue = closedIssue({ departmentId: null, dueAt: null });
    Issue.findOne.mockReturnValue(mockQuery(issue));

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    expect(issue.dueAt).toBeNull();
  });

  it('notifies the assignee and every admin', async () => {
    const issue = closedIssue({
      departmentId: { _id: 'd1', name: 'Đội hạ tầng', slaHours: null },
      assigneeId: 'staff1',
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    const notified = Notification.create.mock.calls.map(([d]) => String(d.userId));
    expect(notified).toContain('staff1');
    expect(notified).toContain('admin1');
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'issue_reopened' })
    );
  });

  it('falls back to the whole department when nobody claimed the issue', async () => {
    const issue = closedIssue({
      departmentId: { _id: 'd1', name: 'Đội hạ tầng', slaHours: null },
      assigneeId: null,
    });
    Issue.findOne.mockReturnValue(mockQuery(issue));
    User.find
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([{ _id: 'staffA' }, { _id: 'staffB' }]) })
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([{ _id: 'admin1' }]) });

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    const notified = Notification.create.mock.calls.map(([d]) => String(d.userId));
    expect(notified).toEqual(expect.arrayContaining(['staffA', 'staffB', 'admin1']));
  });

  it('queues a priority recalculation', async () => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue()));

    await reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' });

    expect(enqueuePriorityRecalculation).toHaveBeenCalledWith('i1');
  });

  it('survives a notification failure without losing the reopen', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    Notification.create.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      reopenService.reopenIssue('i1', 'reporter1', { reason: 'Chưa xử lý thật' })
    ).resolves.toBeTruthy();
    expect(issue.save).toHaveBeenCalled();
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

      expect(issue.save).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });
  });
});
