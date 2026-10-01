jest.mock('../../src/models/Issue');
jest.mock('../../src/models/Notification');
jest.mock('../../src/models/User');
jest.mock('../../src/config/socket');
jest.mock('../../src/config/cloudinary');

const Issue = require('../../src/models/Issue');
const issueService = require('../../src/services/issueService');

/**
 * Mở lại sự cố (G8) chỉ có ý nghĩa nếu đơn vị THẤY được phiếu nào bị người dân
 * phản đối kết quả. Trước đây danh sách không trả `reopenCount` (không nằm trong
 * ISSUE_LIST_FIELDS) nên cổng cán bộ không thể đánh dấu, và cũng không lọc được:
 * phiếu bị mở lại trông y hệt mọi phiếu "Đang xử lý" khác.
 */
const mockQuery = (result) => {
  const query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
  for (const m of ['populate', 'select', 'sort', 'skip', 'limit', 'lean']) query[m] = jest.fn(() => query);
  return query;
};

describe('getIssues — phiếu bị người dân mở lại', () => {
  let query;
  beforeEach(() => {
    jest.clearAllMocks();
    query = mockQuery([]);
    Issue.find.mockReturnValue(query);
    Issue.countDocuments.mockResolvedValue(0);
  });

  it('returns reopenCount and lastReopenedAt in the list payload', async () => {
    await issueService.getIssues({});
    const fields = query.select.mock.calls[0][0].split(' ');
    expect(fields).toEqual(expect.arrayContaining(['reopenCount', 'lastReopenedAt']));
  });

  it('filters to reopened issues when reopened=true', async () => {
    await issueService.getIssues({ reopened: 'true' });
    expect(Issue.find).toHaveBeenCalledWith(expect.objectContaining({ reopenCount: { $gt: 0 } }));
  });

  it('accepts a boolean true as well as the query string "true"', async () => {
    await issueService.getIssues({ reopened: true });
    expect(Issue.find).toHaveBeenCalledWith(expect.objectContaining({ reopenCount: { $gt: 0 } }));
  });

  // Query string có thể mang object (?reopened[$ne]=x). Chỉ nhận đúng "true".
  it.each([['false'], [undefined], [{ $ne: 0 }], ['1']])('ignores reopened=%p', async (value) => {
    await issueService.getIssues({ reopened: value });
    expect(Issue.find.mock.calls[0][0]).not.toHaveProperty('reopenCount');
  });

  // Bộ lọc mới không được phá ràng buộc phạm vi đơn vị của cán bộ.
  it('still scopes staff to their own department', async () => {
    await issueService.getIssues({
      reopened: 'true',
      departmentId: '507f1f77bcf86cd799439099',
      requester: { role: 'staff', departmentId: '507f1f77bcf86cd799439011' },
    });
    expect(Issue.find).toHaveBeenCalledWith(expect.objectContaining({
      reopenCount: { $gt: 0 },
      departmentId: '507f1f77bcf86cd799439011',
    }));
  });

  // Bản đồ có payload rút gọn riêng — không kéo field này vào.
  it('does not add reopen fields to the compact map payload', async () => {
    await issueService.getIssues({ view: 'map' });
    expect(query.select.mock.calls[0][0]).not.toContain('reopenCount');
  });
});
