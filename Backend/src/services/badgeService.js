const Issue = require('../models/Issue');
const { getBadgesForCount, getNextBadge, BADGE_CONFIG } = require('../utils/badgeConfig');

const getUserBadges = async (userId) => {
  // Sự cố đã xoá mềm không tính vào thành tích.
  const issueCount = await Issue.countDocuments({ userId, isDeleted: false });
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
  const leaders = await Issue.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$userId', issueCount: { $sum: 1 } } },
    { $sort: { issueCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
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
