jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');
jest.mock('../../src/services/priorityService');

const Issue = require('../../src/models/Issue');
const User = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const { getIO } = require('../../src/config/socket');
const ratingService = require('../../src/services/ratingService');
const assignmentService = require('../../src/services/assignmentService');
const slaService = require('../../src/services/slaService');
const { ESCALATION_LEVELS } = require('../../src/utils/slaConfig');

const mockIO = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

/** Mock Mongoose Query: method chain trả về chính nó, await ra `result`. */
const mockQuery = (result) => {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ['populate', 'select', 'sort', 'skip', 'limit', 'lean']) q[m] = jest.fn(() => q);
  return q;
};

const notifiedIds = () => Notification.create.mock.calls.map(([d]) => String(d.userId));
const notifiedTypes = () => Notification.create.mock.calls.map(([d]) => d.type);

describe('G13 — chấm điểm không còn là ngõ cụt', () => {
  const closedIssue = (overrides = {}) => ({
    _id: 'i1',
    title: 'Ổ gà',
    userId: { _id: 'reporter1' },
    status: 'resolved',
    rating: { score: null },
    departmentId: { _id: 'd1', name: 'Đội hạ tầng' },
    assigneeId: 'staff1',
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    Notification.create.mockResolvedValue({ _id: 'n1' });
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'admin1' }]) });
    // Điểm được ghi bằng một lệnh có điều kiện (chưa có điểm + đúng trạng thái).
    Issue.findOneAndUpdate.mockImplementation((filter, update) => mockQuery({ _id: filter._id, rating: update.$set.rating }));
  });

  // Trước đây ratingService chỉ ghi rồi save(): không import Notification, không
  // socket, không email, không nhánh nào cho điểm thấp. Chấm 1 sao không kích
  // hoạt gì — trong khi hệ thống lại chủ động gửi email MỜI đánh giá.
  it('tells the staff member who handled the issue', async () => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue()));

    await ratingService.rateIssue('i1', 'reporter1', { score: 5 });

    expect(notifiedIds()).toContain('staff1');
    expect(notifiedTypes()).toContain('issue_rated');
  });

  it('falls back to the whole department when nobody claimed it', async () => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue({ assigneeId: null })));
    User.find.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue([{ _id: 'staffA' }, { _id: 'staffB' }]),
    });

    await ratingService.rateIssue('i1', 'reporter1', { score: 4 });

    expect(notifiedIds()).toEqual(expect.arrayContaining(['staffA', 'staffB']));
  });

  // Điểm thấp là tín hiệu chất lượng, không chỉ là một việc đã xong.
  it.each([1, 2])('escalates a %i-star rating to admins', async (score) => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue()));

    await ratingService.rateIssue('i1', 'reporter1', { score });

    expect(notifiedIds()).toContain('admin1');
  });

  it.each([3, 4, 5])('does not bother admins with a %i-star rating', async (score) => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue()));

    await ratingService.rateIssue('i1', 'reporter1', { score });

    expect(notifiedIds()).not.toContain('admin1');
  });

  it('does not notify the same person twice', async () => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue({ assigneeId: 'admin1' })));

    await ratingService.rateIssue('i1', 'reporter1', { score: 1 });

    expect(notifiedIds().filter((id) => id === 'admin1')).toHaveLength(1);
  });

  // Nhóm có khả năng không hài lòng nhất lại là nhóm trước đây không đánh giá được.
  it('now lets a rejected issue be rated too', async () => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue({ status: 'rejected' })));

    await expect(ratingService.rateIssue('i1', 'reporter1', { score: 2 })).resolves.toBeTruthy();
  });

  it('still refuses a rating while the issue is open', async () => {
    Issue.findOne.mockReturnValue(mockQuery(closedIssue({ status: 'processing' })));

    await expect(ratingService.rateIssue('i1', 'reporter1', { score: 5 }))
      .rejects.toMatchObject({ code: 'ISSUE_NOT_CLOSED' });
  });

  it('keeps the rating even if sending a notification fails', async () => {
    const issue = closedIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    Notification.create.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(ratingService.rateIssue('i1', 'reporter1', { score: 1 })).resolves.toMatchObject({ rating: { score: 1 } });
    expect(Issue.findOneAndUpdate).toHaveBeenCalled();
    console.warn.mockRestore();
  });
});

describe('G14 — thu hồi phân công không còn im lặng', () => {
  const assignedIssue = (overrides = {}) => ({
    _id: 'i1',
    title: 'Ổ gà',
    status: 'processing',
    departmentId: 'd1',
    assigneeId: 'staff1',
    statusHistory: [],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    Notification.create.mockResolvedValue({ _id: 'n1' });
    // Thu hồi giờ là một lệnh ghi có điều kiện; trả bản sau khi thu hồi.
    Issue.findOneAndUpdate.mockImplementation((filter, update) => Promise.resolve({
      _id: filter._id, title: 'Ổ gà', status: filter.status, ...update.$set,
    }));
  });

  it('tells the staff member their work was taken away', async () => {
    Issue.findOne.mockResolvedValue(assignedIssue());

    await assignmentService.unassignIssue('i1', { note: 'Chuyển đơn vị khác' }, { id: 'admin1' });

    expect(notifiedIds()).toContain('staff1');
    expect(notifiedTypes()).toContain('issue_unassigned');
  });

  it('includes the reason so it is not a bare notification', async () => {
    Issue.findOne.mockResolvedValue(assignedIssue());

    await assignmentService.unassignIssue('i1', { note: 'Sai đơn vị phụ trách' }, { id: 'admin1' });

    expect(Notification.create.mock.calls[0][0].message).toContain('Sai đơn vị phụ trách');
  });

  it('notifies the whole department when nobody had claimed it', async () => {
    Issue.findOne.mockResolvedValue(assignedIssue({ assigneeId: null }));
    User.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'staffA' }, { _id: 'staffB' }]),
    });

    await assignmentService.unassignIssue('i1', {}, { id: 'admin1' });

    expect(notifiedIds()).toEqual(expect.arrayContaining(['staffA', 'staffB']));
  });

  it('completes the unassign even if the notification fails', async () => {
    const issue = assignedIssue();
    Issue.findOne.mockResolvedValue(issue);
    Notification.create.mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(assignmentService.unassignIssue('i1', {}, { id: 'admin1' }))
      .resolves.toMatchObject({ departmentId: null, assigneeId: null });
    console.warn.mockRestore();
  });
});

describe('G11 — leo cấp không còn dừng ở cấp 2 rồi im lặng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue(mockIO);
    Notification.create.mockResolvedValue({ _id: 'n1' });
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([{ _id: 'admin1', email: 'a@b.c' }]) });
    Issue.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  // Trước đây query chỉ khớp escalationLevel === 1, nên phiếu lên mức 2 là im
  // lặng vĩnh viễn: phiếu quá hạn 3 tháng nhận đúng số thông báo bằng phiếu
  // quá hạn 25 giờ.
  it('also picks up issues that are already at the top level', async () => {
    Issue.find.mockReturnValue(mockQuery([]));

    await slaService.escalateOverdueIssues(new Date());

    const filter = Issue.find.mock.calls[0][0];
    expect(filter.escalationLevel).toEqual({ $gte: ESCALATION_LEVELS.REMINDED });
  });

  it('keeps the 24h cooldown so it does not spam every hour', async () => {
    Issue.find.mockReturnValue(mockQuery([]));
    const now = new Date('2026-10-01T12:00:00Z');

    await slaService.escalateOverdueIssues(now);

    const filter = Issue.find.mock.calls[0][0];
    expect(filter.lastReminderAt.$lt).toEqual(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  });

  it('flags repeat offenders so admins can tell them apart', async () => {
    Issue.find.mockReturnValue(mockQuery([
      {
        _id: 'i1', title: 'Ổ gà', dueAt: new Date(Date.now() - 86400000),
        departmentId: { name: 'Đội hạ tầng' },
        escalationLevel: ESCALATION_LEVELS.ESCALATED,
      },
    ]));

    await slaService.escalateOverdueIssues(new Date());

    expect(Notification.create.mock.calls[0][0].message).toMatch(/vòng trước/);
  });
});
