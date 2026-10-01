jest.mock('../../src/models/Issue');
jest.mock('../../src/models/User');

const Issue = require('../../src/models/Issue');
const { getLeaderboard, getUserBadges } = require('../../src/services/badgeService');

/**
 * Bảng xếp hạng là trang CÔNG KHAI và là cơ chế khuyến khích, nên phải đếm đúng
 * thứ hệ thống muốn khuyến khích:
 *
 * - Phiếu bị TỪ CHỐI không được tính. Nếu tính, người gửi phiếu rác nhiều nhất
 *   đứng đầu bảng — cơ chế thưởng cho đúng hành vi cần chặn.
 * - Tài khoản đã xoá (B8 ẩn danh hoá thành "Người dùng đã xoá", isActive=false)
 *   hoặc bị khoá không được xuất hiện trên một trang công khai.
 * - Lọc tài khoản phải chạy TRƯỚC $limit, nếu không top 10 có thể chỉ còn 7 dòng.
 */
describe('badgeService.getLeaderboard', () => {
  let pipeline;
  beforeEach(() => {
    Issue.aggregate.mockImplementation(async (p) => { pipeline = p; return []; });
  });

  const stageIndex = (predicate) => pipeline.findIndex(predicate);

  it('does not count rejected reports', async () => {
    await getLeaderboard(10);
    const match = pipeline[0].$match;
    expect(match.isDeleted).toBe(false);
    expect(match.status).toEqual({ $ne: 'rejected' });
  });

  it('excludes deleted and deactivated accounts', async () => {
    await getLeaderboard(10);
    const i = stageIndex((s) => s.$match && s.$match['user.isActive'] !== undefined);
    expect(i).toBeGreaterThan(-1);
    expect(pipeline[i].$match['user.isActive']).toBe(true);
  });

  it('applies the account filter before the limit, so the list stays full', async () => {
    await getLeaderboard(10);
    const filterAt = stageIndex((s) => s.$match && s.$match['user.isActive'] !== undefined);
    const limitAt = stageIndex((s) => s.$limit !== undefined);
    expect(filterAt).toBeGreaterThan(-1); // không để -1 < limitAt cho pass ăn may
    expect(filterAt).toBeLessThan(limitAt);
    expect(pipeline[limitAt].$limit).toBe(10);
  });

  it('never exposes email or other private fields', async () => {
    await getLeaderboard(10);
    const project = pipeline.find((s) => s.$project).$project;
    expect(Object.keys(project).sort()).toEqual(['_id', 'avatar', 'issueCount', 'name', 'userId']);
  });
});

// Huy hiệu cá nhân phải đếm cùng quy tắc với bảng xếp hạng, nếu không trang cá
// nhân ghi 20 phản ánh còn bảng xếp hạng ghi 15 cho cùng một người.
describe('badgeService.getUserBadges', () => {
  it('counts with the same rule as the leaderboard — rejected reports excluded', async () => {
    Issue.countDocuments.mockResolvedValue(3);
    await getUserBadges('507f1f77bcf86cd799439011');
    expect(Issue.countDocuments).toHaveBeenCalledWith({
      userId: '507f1f77bcf86cd799439011',
      isDeleted: false,
      status: { $ne: 'rejected' },
    });
  });
});
