jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Department');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');
jest.mock('../../src/services/priorityService');
jest.mock('../../src/services/emailService');

const Issue = require('../../src/models/Issue');
const Department = require('../../src/models/Department');
const User = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const { getIO } = require('../../src/config/socket');
const assignmentService = require('../../src/services/assignmentService');

/** Mock Mongoose Query: method chain trả về chính nó, await ra `result`. */
const mockQuery = (result) => {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ['populate', 'select', 'sort', 'skip', 'limit', 'lean']) q[m] = jest.fn(() => q);
  return q;
};

const department = { _id: 'deptA', name: 'Đội hạ tầng', email: 'doi@example.com', slaHours: null, isActive: true };

/**
 * Phân công / thu hồi trước đây đọc → sửa → save: hai admin thao tác cùng lúc
 * thì người sau ghi đè người trước, cả hai đơn vị đều nhận email "được giao việc".
 * Giờ là một lệnh ghi có điều kiện trên đúng tình trạng phân công vừa đọc.
 */
describe('assignmentService — ghi có điều kiện', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue({ to: jest.fn().mockReturnThis(), emit: jest.fn() });
    Notification.create.mockResolvedValue({ _id: 'n1' });
    Department.findOne.mockResolvedValue(department);
    User.find.mockReturnValue(mockQuery([]));
  });

  describe('assignIssue()', () => {
    const unassigned = () => ({
      _id: 'i1', title: 'Ổ gà', category: 'pothole', status: 'reported',
      departmentId: null, assigneeId: null, mergedInto: null,
    });

    it('writes only if the issue is still exactly as read (status + department + assignee)', async () => {
      Issue.findOne.mockResolvedValue(unassigned());
      const updated = { _id: 'i1', title: 'Ổ gà', status: 'processing', populate: jest.fn().mockResolvedValue(true) };
      Issue.findOneAndUpdate.mockResolvedValue(updated);

      const result = await assignmentService.assignIssue('i1', { departmentId: 'deptA' }, { id: 'admin1' });

      const [filter, update] = Issue.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({
        _id: 'i1', isDeleted: false, mergedInto: null, status: 'reported', departmentId: null, assigneeId: null,
      });
      expect(update.$set).toMatchObject({ departmentId: 'deptA', assigneeId: null, status: 'processing', escalationLevel: 0 });
      expect(update.$set.dueAt).toBeInstanceOf(Date);
      expect(update.$push.statusHistory).toMatchObject({ status: 'processing', changedBy: 'admin1' });
      expect(result).toBe(updated);
      expect(result.$locals.previousDepartmentId).toBeNull();
    });

    it('409 ASSIGNMENT_CONFLICT and no email when someone else changed the issue first', async () => {
      Issue.findOne.mockResolvedValue(unassigned());
      Issue.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        assignmentService.assignIssue('i1', { departmentId: 'deptA' }, { id: 'admin1' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSIGNMENT_CONFLICT' });
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it('reassignment keeps the previous department for the audit log', async () => {
      Issue.findOne.mockResolvedValue({ ...unassigned(), status: 'processing', departmentId: 'deptOld', assigneeId: 'staffOld' });
      Issue.findOneAndUpdate.mockResolvedValue({ _id: 'i1', title: 'Ổ gà', populate: jest.fn().mockResolvedValue(true) });

      const result = await assignmentService.assignIssue('i1', { departmentId: 'deptA' }, { id: 'admin1' });

      expect(Issue.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ departmentId: 'deptOld', assigneeId: 'staffOld' });
      expect(result.$locals.previousDepartmentId).toBe('deptOld');
    });
  });

  describe('unassignIssue()', () => {
    it('refuses to unassign a closed issue (it would drop out of the department statistics)', async () => {
      Issue.findOne.mockResolvedValue({ _id: 'i1', status: 'resolved', departmentId: 'deptA', assigneeId: 'staff1' });

      await expect(
        assignmentService.unassignIssue('i1', { note: 'x' }, { id: 'admin1' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'ISSUE_CLOSED' });
      expect(Issue.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('409 ASSIGNMENT_CONFLICT when the assignment changed in between', async () => {
      Issue.findOne.mockResolvedValue({ _id: 'i1', status: 'processing', departmentId: 'deptA', assigneeId: null });
      Issue.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        assignmentService.unassignIssue('i1', {}, { id: 'admin1' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'ASSIGNMENT_CONFLICT' });
      expect(Issue.findOneAndUpdate.mock.calls[0][0]).toEqual({
        _id: 'i1', isDeleted: false, status: 'processing', departmentId: 'deptA', assigneeId: null,
      });
      expect(Notification.create).not.toHaveBeenCalled();
    });
  });
});
