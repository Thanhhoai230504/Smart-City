jest.mock('../../src/models/Issue');
// G13 bổ sung thông báo cho người xử lý và cho admin khi điểm thấp.
jest.mock('../../src/models/User');
jest.mock('../../src/models/Notification');
jest.mock('../../src/config/socket');

const Issue = require('../../src/models/Issue');
const ratingService = require('../../src/services/ratingService');

// Service giờ populate departmentId để biết tên đơn vị khi báo điểm thấp lên admin.
const mockQuery = (result) => {
  const q = { then: (res, rej) => Promise.resolve(result).then(res, rej) };
  for (const m of ['populate', 'select', 'lean']) q[m] = jest.fn(() => q);
  return q;
};

const baseIssue = (overrides = {}) => ({
  _id: 'i1',
  userId: { _id: 'reporter1' },
  status: 'resolved',
  rating: { score: null },
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const User = require('../../src/models/User');
const Notification = require('../../src/models/Notification');
const { getIO } = require('../../src/config/socket');

describe('ratingService — mã lỗi máy đọc được', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getIO.mockReturnValue({ to: jest.fn().mockReturnThis(), emit: jest.fn() });
    Notification.create.mockResolvedValue({ _id: 'n1' });
    User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  });

  // App mobile phải tắt/mở nút đánh giá dựa trên mã lỗi, không phải bằng cách so
  // khớp chuỗi tiếng Việt — đổi một chữ trong message là app vỡ.
  // Mã đổi từ ISSUE_NOT_RESOLVED sang ISSUE_NOT_CLOSED khi G13 mở cho phiếu bị
  // từ chối cũng được đánh giá — nhóm có khả năng không hài lòng nhất.
  it('tags ISSUE_NOT_CLOSED when the issue is still open', async () => {
    Issue.findOne.mockReturnValue(mockQuery(baseIssue({ status: 'processing' })));

    await expect(
      ratingService.rateIssue('i1', 'reporter1', { score: 5 })
    ).rejects.toMatchObject({ statusCode: 400, code: 'ISSUE_NOT_CLOSED' });
  });

  it('tags ALREADY_RATED when the reporter has already scored', async () => {
    Issue.findOne.mockReturnValue(mockQuery(baseIssue({ rating: { score: 4 } })));

    await expect(
      ratingService.rateIssue('i1', 'reporter1', { score: 5 })
    ).rejects.toMatchObject({ statusCode: 400, code: 'ALREADY_RATED' });
  });

  it('still refuses a non-reporter with 403', async () => {
    Issue.findOne.mockReturnValue(mockQuery(baseIssue()));

    await expect(
      ratingService.rateIssue('i1', 'someoneElse', { score: 5 })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('saves the rating on the happy path with one conditional write', async () => {
    const issue = baseIssue();
    Issue.findOne.mockReturnValue(mockQuery(issue));
    Issue.findOneAndUpdate.mockReturnValue(mockQuery({ ...issue, rating: { score: 5, comment: 'Tốt' } }));

    const result = await ratingService.rateIssue('i1', 'reporter1', { score: 5, comment: 'Tốt' });

    const [filter, update] = Issue.findOneAndUpdate.mock.calls[0];
    // Chỉ ghi khi phiếu còn đúng trạng thái đóng và CHƯA có điểm.
    expect(filter).toEqual({ _id: 'i1', isDeleted: false, mergedInto: null, status: 'resolved', 'rating.score': null });
    expect(update.$set.rating).toMatchObject({ score: 5, comment: 'Tốt' });
    expect(update.$set.rating.ratedAt).toBeInstanceOf(Date);
    expect(result.rating.score).toBe(5);
    expect(issue.save).not.toHaveBeenCalled();
  });

  // Bấm gửi hai lần: request sau không khớp điều kiện → ALREADY_RATED, không ghi đè.
  it('a second concurrent submit gets ALREADY_RATED instead of overwriting', async () => {
    Issue.findOne
      .mockReturnValueOnce(mockQuery(baseIssue()))
      .mockReturnValueOnce(mockQuery({ rating: { score: 5 }, status: 'resolved' }));
    Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));

    await expect(
      ratingService.rateIssue('i1', 'reporter1', { score: 1 })
    ).rejects.toMatchObject({ statusCode: 400, code: 'ALREADY_RATED' });
    expect(Notification.create).not.toHaveBeenCalled();
  });

  // Đánh giá đúng lúc phiếu bị mở lại: không để điểm lượt cũ rơi vào lượt mới.
  it('returns 409 STATUS_CONFLICT when the issue was reopened in between', async () => {
    Issue.findOne
      .mockReturnValueOnce(mockQuery(baseIssue()))
      .mockReturnValueOnce(mockQuery({ rating: { score: null }, status: 'processing' }));
    Issue.findOneAndUpdate.mockReturnValue(mockQuery(null));

    await expect(
      ratingService.rateIssue('i1', 'reporter1', { score: 4 })
    ).rejects.toMatchObject({ statusCode: 409, code: 'STATUS_CONFLICT' });
  });
});
