const Issue = require('../models/Issue');
const { getBadgesForCount, getNextBadge, BADGE_CONFIG } = require('../utils/badgeConfig');

const getUserBadges = async (userId) => {
  // Sự cố đã xoá mềm hoặc bị từ chối không tính vào thành tích — cùng quy tắc
  // với getLeaderboard để hai nơi luôn ra cùng một con số.
  const issueCount = await Issue.countDocuments({ userId, isDeleted: false, status: { $ne: 'rejected' } });
  return {
    issueCount,
    badges: getBadgesForCount(issueCount),
    nextBadge: getNextBadge(issueCount),
    allBadges: BADGE_CONFIG.map(b => ({
      ...b,
      earned: issueCount >= b.threshold,
    })),
  };
};

const getLeaderboard = async (limit = 10) => {
  // Trang công khai và là cơ chế khuyến khích: chỉ đếm phiếu không bị từ chối
  // (nếu không, người gửi rác nhiều nhất đứng đầu), và ẩn tài khoản đã xoá/bị
  // khoá. Lọc tài khoản phải chạy TRƯỚC $limit để top N vẫn đủ N dòng.
  const leaders = await Issue.aggregate([
    { $match: { isDeleted: false, status: { $ne: 'rejected' } } },
    { $group: { _id: '$userId', issueCount: { $sum: 1 } } },
    { $sort: { issueCount: -1 } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: { 'user.isActive': true } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        userId: '$_id',
        name: '$user.name',
        avatar: '$user.avatar',
        issueCount: 1,
      },
    },
  ]);

  return leaders.map((l, i) => ({
    ...l,
    rank: i + 1,
    badges: getBadgesForCount(l.issueCount),
    topBadge: getBadgesForCount(l.issueCount).pop() || null,
  }));
};

module.exports = { getUserBadges, getLeaderboard };
