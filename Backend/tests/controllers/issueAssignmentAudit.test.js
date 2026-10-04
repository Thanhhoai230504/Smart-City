jest.mock('../../src/services/issueService');
jest.mock('../../src/services/ratingService');
jest.mock('../../src/services/assignmentService');
jest.mock('../../src/services/duplicateService');
jest.mock('../../src/services/auditService');
jest.mock('../../src/services/priorityService');
jest.mock('../../src/models/Issue');

const assignmentService = require('../../src/services/assignmentService');
const auditService = require('../../src/services/auditService');
const issueController = require('../../src/controllers/issueController');

/**
 * Đánh giá đơn vị cần biết đơn vị nào từng bị LẤY việc (thu hồi, hoặc phân công lại
 * sang đơn vị khác). Trước đây nhật ký thu hồi chỉ ghi lý do, nhật ký phân công chỉ
 * ghi đơn vị MỚI — đơn vị cũ mất dấu hoàn toàn.
 */
const run = async (handler, body) => {
  const res = { json: jest.fn() };
  const next = jest.fn();
  await issueController[handler]({ params: { id: 'i1' }, body, user: { id: 'admin1', role: 'admin' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  return auditService.recordAudit.mock.calls[0][0].metadata;
};

describe('issueController — audit trail of assignment changes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auditService.recordAudit.mockResolvedValue();
  });

  it('records the previous department when an issue is reassigned', async () => {
    assignmentService.assignIssue.mockResolvedValue({ _id: 'i1', title: 'x', $locals: { previousDepartmentId: 'dOld' } });
    const meta = await run('assignIssue', { departmentId: 'dNew' });
    expect(meta).toEqual(expect.objectContaining({ departmentId: 'dNew', previousDepartmentId: 'dOld' }));
  });

  it('records null when the issue had no department before', async () => {
    assignmentService.assignIssue.mockResolvedValue({ _id: 'i1', title: 'x', $locals: {} });
    const meta = await run('assignIssue', { departmentId: 'dNew' });
    expect(meta.previousDepartmentId).toBeNull();
  });

  it('records which department lost the issue on unassignment', async () => {
    assignmentService.unassignIssue.mockResolvedValue({ _id: 'i1', title: 'x', $locals: { previousDepartmentId: 'dOld' } });
    const meta = await run('unassignIssue', { note: 'Đơn vị không có thiết bị' });
    expect(meta).toEqual(expect.objectContaining({ previousDepartmentId: 'dOld', note: 'Đơn vị không có thiết bị' }));
  });
});
