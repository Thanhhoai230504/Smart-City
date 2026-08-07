jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Department');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');
jest.mock('../../src/services/emailService');

const Issue = require('../../src/models/Issue');
const assignmentService = require('../../src/services/assignmentService');

const mockQuery = (result) => {
  const query = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  query.populate = jest.fn(() => query);
  return query;
};

describe('AssignmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('claimIssue()', () => {
    it('should only allow staff accounts with a department to claim work', async () => {
      await expect(
        assignmentService.claimIssue('issue1', { id: 'admin1', role: 'admin', departmentId: null })
      ).rejects.toThrow('Chỉ cán bộ đã được gán đơn vị');

      expect(Issue.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should claim only an open, unclaimed issue in the staff department', async () => {
      const claimedIssue = { _id: 'issue1', assigneeId: 'staff1' };
      Issue.findOneAndUpdate.mockReturnValue(mockQuery(claimedIssue));

      const result = await assignmentService.claimIssue('issue1', {
        id: 'staff1',
        role: 'staff',
        departmentId: 'deptA',
      });

      expect(Issue.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: 'issue1',
          isDeleted: false,
          mergedInto: null,
          departmentId: 'deptA',
          assigneeId: null,
          status: { $in: ['reported', 'processing'] },
        },
        { assigneeId: 'staff1' },
        { new: true }
      );
      expect(result).toBe(claimedIssue);
    });

    it('should reject when another staff member already claimed the issue', async () => {
      Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));

      await expect(
        assignmentService.claimIssue('issue1', {
          id: 'staff1',
          role: 'staff',
          departmentId: 'deptA',
        })
      ).rejects.toThrow('đã có người nhận');
    });
  });
});
