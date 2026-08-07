const Issue = require('../models/Issue');
const User = require('../models/User');
const Place = require('../models/Place');
const { UNKNOWN_DISTRICT } = require('../utils/districts');

const getStats = async () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Bỏ qua sự cố đã xoá mềm ở mọi số liệu.
  const activeMatch = { isDeleted: false, mergedInto: null };

  const [
    totalIssues, issuesToday, issuesThisWeek, issuesThisMonth,
    issuesByStatus, issuesByCategory, issuesTrend,
    totalUsers, totalPlaces, recentIssues,
    districtAgg, topVotedIssues
  ] = await Promise.all([
    Issue.countDocuments(activeMatch),
    Issue.countDocuments({ ...activeMatch, createdAt: { $gte: today } }),
    Issue.countDocuments({ ...activeMatch, createdAt: { $gte: thisWeek } }),
    Issue.countDocuments({ ...activeMatch, createdAt: { $gte: thisMonth } }),
    Issue.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Issue.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Issue.aggregate([
      { $match: { ...activeMatch, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    User.countDocuments(),
    Place.countDocuments({ isActive: true }),
    Issue.find(activeMatch)
      .populate('userId', 'name email')
      .sort('-createdAt')
      .limit(5)
      .select('title category status location createdAt'),

    // Gom nhóm theo quận ngay trong DB, thay cho việc client tải 500 issue
    // về rồi tự group bằng chuỗi location.
    Issue.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$district', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),

    // Top 5 sự cố nhiều vote nhất — cũng để DB sort thay vì client.
    Issue.find({ ...activeMatch, voteCount: { $gt: 0 } })
      .sort('-voteCount')
      .limit(5)
      .select('title status location voteCount')
      .lean()
  ]);

  const statusMap = { reported: 0, processing: 0, resolved: 0, rejected: 0 };
  issuesByStatus.forEach(item => { statusMap[item._id] = item.count; });

  const categoryLabels = {
    pothole: 'Ổ gà', garbage: 'Rác thải', streetlight: 'Đèn đường hỏng',
    flooding: 'Ngập nước', tree: 'Cây đổ', other: 'Khác'
  };

  return {
    overview: { totalIssues, issuesToday, issuesThisWeek, issuesThisMonth, totalUsers, totalPlaces },
    issuesByStatus: statusMap,
    issuesByCategory: issuesByCategory.map(item => ({
      category: item._id, label: categoryLabels[item._id] || item._id, count: item.count
    })),
    issuesTrend: issuesTrend.map(item => ({ date: item._id, count: item.count })),
    issuesByDistrict: districtAgg.map(item => ({
      name: item._id || UNKNOWN_DISTRICT, count: item.count
    })),
    topVotedIssues,
    recentIssues
  };
};

module.exports = { getStats };
