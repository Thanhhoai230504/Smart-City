jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');
jest.mock('../../src/services/emailService');

const Issue = require('../../src/models/Issue');
const User = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const { getIO } = require('../../src/config/socket');
const { sendEmail } = require('../../src/services/emailService');
const slaService = require('../../src/services/slaService');

const mockIO = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

/** Mock Mongoose Query: mọi method chain trả về chính nó, await ra `result`. */
const mockQuery = (result) => {
  const query = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ['populate', 'select', 'sort', 'skip', 'limit', 'lean']) {
    query[m] = jest.fn(() => query);
  }
  return query;
};

const HOUR = 60 * 60 * 1000;
const now = new Date('2026-09-09T12:00:00Z');
const staleIssue = {
  _id: 'i1', title: 'Ổ gà', location: 'Hải Châu',
  category: 'pothole', intakeDueAt: new Date(now - 5 * HOUR),
};

describe('slaService — E6: phiếu CHƯA PHÂN CÔNG', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    Notification.create.mockResolvedValue({ _id: 'notif1' });
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'admin1', name: 'Admin', email: 'a@b.c' }]),
    });
    Issue.updateMany.mockResolvedValue({ modifiedCount: 1 });
    sendEmail.mockResolvedValue(true);
  });

  // Điểm mù trước đây: dueAt chỉ được gán khi phân công, và cả hai lượt quét SLA
  // đều lọc `departmentId: { $ne: null }` — nên phiếu nằm trong hàng chờ phân công
  // không bao giờ sinh ra một thông báo nào, dù tồn đọng bao lâu đi nữa.
  it('flags unassigned issues that passed the intake deadline', async () => {
    Issue.find.mockReturnValue(mockQuery([staleIssue]));

    const result = await slaService.remindUnassignedIssues(now);

    expect(result.unassigned).toBe(1);
    // Người duy nhất có quyền phân công là admin.
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin1', type: 'intake_overdue' })
    );
    expect(mockIO.to).toHaveBeenCalledWith('user_admin1');
    expect(sendEmail).toHaveBeenCalled();
  });

  it('only scans issues with no department assigned', async () => {
    Issue.find.mockReturnValue(mockQuery([]));

    await slaService.remindUnassignedIssues(now);

    const filter = Issue.find.mock.calls[0][0];
    expect(filter.departmentId).toBeNull();
    expect(filter.intakeDueAt.$lt).toEqual(now);
    expect(filter.isDeleted).toBe(false);
    expect(filter.mergedInto).toBeNull();
  });

  it('marks the reminder time so the next hourly scan does not repeat it', async () => {
    Issue.find.mockReturnValue(mockQuery([staleIssue]));

    await slaService.remindUnassignedIssues(now);

    expect(Issue.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['i1'] } },
      { intakeReminderAt: now }
    );
  });

  it('re-reminds after the 24h cooldown instead of going silent forever', async () => {
    Issue.find.mockReturnValue(mockQuery([]));

    await slaService.remindUnassignedIssues(now);

    // Chuỗi leo cấp SLA hiện tại dừng ở cấp 2 rồi im lặng vĩnh viễn (G11).
    // Lượt nhắc tiếp nhận phải tránh lặp lại đúng lỗi đó: hỏi cả nhánh "chưa
    // nhắc lần nào" lẫn "đã nhắc nhưng quá 24 giờ".
    const filter = Issue.find.mock.calls[0][0];
    expect(filter.$or).toEqual([
      { intakeReminderAt: null },
      { intakeReminderAt: { $lt: new Date(now.getTime() - 24 * HOUR) } },
    ]);
  });

  it('does nothing when there is no stale unassigned issue', async () => {
    Issue.find.mockReturnValue(mockQuery([]));

    const result = await slaService.remindUnassignedIssues(now);

    expect(result.unassigned).toBe(0);
    expect(Notification.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('survives a notification failure without aborting the scan', async () => {
    Issue.find.mockReturnValue(mockQuery([staleIssue]));
    Notification.create.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(slaService.remindUnassignedIssues(now)).resolves.toEqual({ unassigned: 1 });
    console.warn.mockRestore();
  });

  it('is part of the full SLA sweep run by the cron', async () => {
    Issue.find.mockReturnValue(mockQuery([]));

    const result = await slaService.runSlaCheck(now);

    expect(result).toHaveProperty('unassigned');
    expect(result).toHaveProperty('reminded');
    expect(result).toHaveProperty('escalated');
  });
});
