jest.mock('../../src/services/issueService');
jest.mock('../../src/services/ratingService');
jest.mock('../../src/services/assignmentService');
jest.mock('../../src/services/duplicateService');
jest.mock('../../src/services/auditService');
jest.mock('../../src/services/priorityService');
jest.mock('../../src/models/Issue');

const issueService = require('../../src/services/issueService');
const issueController = require('../../src/controllers/issueController');

/**
 * `GET /api/issues/nearby` là route CÔNG KHAI, không có validator.
 *
 * Trước đây controller `parseFloat`/`parseInt` thẳng tham số: `lat=abc` thành
 * NaN, MongoDB ném lỗi và client nhận 500 thay vì 400; `radius` không có trần nên
 * `radius=999999999` bắt $geoNear quét cả index địa lý. Web giờ gọi route này từ
 * trang chi tiết sự cố, nên phải chặn ở đây.
 */
const call = async (query) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await issueController.getNearbyIssues({ query }, res, next);
  return { res, next };
};

describe('IssueController — getNearbyIssues()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    issueService.getNearbyIssues.mockResolvedValue([]);
  });

  it('forwards valid coordinates and radius to the service', async () => {
    const { res } = await call({ lat: '16.0544', lng: '108.2022', radius: '500' });
    expect(issueService.getNearbyIssues).toHaveBeenCalledWith(16.0544, 108.2022, 500);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { issues: [] } });
  });

  it.each([
    ['missing lat', { lng: '108.2' }],
    ['non-numeric lat', { lat: 'abc', lng: '108.2' }],
    ['non-numeric lng', { lat: '16.05', lng: 'xyz' }],
    ['lat out of range', { lat: '91', lng: '108.2' }],
    ['lng out of range', { lat: '16.05', lng: '181' }],
  ])('rejects %s with 400 and never queries', async (_, query) => {
    const { res } = await call(query);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issueService.getNearbyIssues).not.toHaveBeenCalled();
  });

  it('caps an oversized radius instead of scanning the whole index', async () => {
    await call({ lat: '16.05', lng: '108.2', radius: '999999999' });
    expect(issueService.getNearbyIssues).toHaveBeenCalledWith(16.05, 108.2, 2000);
  });

  it('falls back to the default radius when radius is not a number', async () => {
    await call({ lat: '16.05', lng: '108.2', radius: 'abc' });
    expect(issueService.getNearbyIssues).toHaveBeenCalledWith(16.05, 108.2, 300);
  });

  it('raises a too-small radius to the floor', async () => {
    await call({ lat: '16.05', lng: '108.2', radius: '-5' });
    expect(issueService.getNearbyIssues).toHaveBeenCalledWith(16.05, 108.2, 50);
  });
});
