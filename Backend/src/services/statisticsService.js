const Issue = require('../models/Issue');

const DA_NANG_DISTRICTS = [
  'Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn',
  'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang',
];

const getPublicStatistics = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalIssues, issuesByStatus, issuesByCategory,
    issuesTrend, avgResolutionTime, issuesByDistrict, ratingStats,
  ] = await Promise.all([
    Issue.countDocuments(),

    Issue.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    Issue.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Issue.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Issue.aggregate([
      { $match: { status: 'resolved', resolvedAt: { $ne: null } } },
      {
        $project: {
          resolutionHours: {
            $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avgHours: { $avg: '$resolutionHours' } } },
    ]),

    // Thống kê theo quận
    Promise.all(
      DA_NANG_DISTRICTS.map(async (district) => {
        const [total, resolved] = await Promise.all([
          Issue.countDocuments({ location: { $regex: district, $options: 'i' } }),
          Issue.countDocuments({ location: { $regex: district, $options: 'i' }, status: 'resolved' }),
        ]);
        return { district, total, resolved, rate: total > 0 ? Math.round((resolved / total) * 100) : 0 };
      })
    ),

    // Rating stats
    Issue.aggregate([
      { $match: { 'rating.score': { $ne: null } } },
      {
        $group: {
          _id: null,
          average: { $avg: '$rating.score' },
          total: { $sum: 1 },
          scores: { $push: '$rating.score' },
        },
      },
    ]),
  ]);

  // Build status map
  const statusMap = { reported: 0, processing: 0, resolved: 0, rejected: 0 };
  issuesByStatus.forEach((item) => { statusMap[item._id] = item.count; });
  const resolvedCount = statusMap.resolved;
  const resolutionRate = totalIssues > 0 ? Math.round((resolvedCount / totalIssues) * 100) : 0;

  // Category labels
  const categoryLabels = {
    pothole: 'Ổ gà', garbage: 'Rác thải', streetlight: 'Đèn đường hỏng',
    flooding: 'Ngập nước', tree: 'Cây đổ', other: 'Khác',
  };

  // Rating distribution
  const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (ratingStats.length) {
    ratingStats[0].scores.forEach((s) => { ratingDist[s] = (ratingDist[s] || 0) + 1; });
  }

  return {
    overview: {
      totalIssues,
      resolvedCount,
      resolutionRate,
      avgResolutionHours: avgResolutionTime.length
        ? Math.round(avgResolutionTime[0].avgHours * 10) / 10
        : 0,
    },
    issuesByStatus: statusMap,
    issuesByCategory: issuesByCategory.map((item) => ({
      category: item._id,
      label: categoryLabels[item._id] || item._id,
      count: item.count,
    })),
    issuesTrend: issuesTrend.map((item) => ({ date: item._id, count: item.count })),
    issuesByDistrict: issuesByDistrict.sort((a, b) => b.total - a.total),
    rating: {
      average: ratingStats.length ? Math.round(ratingStats[0].average * 10) / 10 : 0,
      total: ratingStats.length ? ratingStats[0].total : 0,
      distribution: ratingDist,
    },
  };
};

module.exports = { getPublicStatistics };
