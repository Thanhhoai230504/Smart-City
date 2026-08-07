const Issue = require('../models/Issue');
const { DA_NANG_DISTRICTS } = require('../utils/districts');

const getPublicStatistics = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Chỉ tính các sự cố chưa bị xoá mềm.
  const activeMatch = { isDeleted: false, mergedInto: null };

  const [
    totalIssues, issuesByStatus, issuesByCategory,
    issuesTrend, avgResolutionTime, districtAgg, ratingStats,
  ] = await Promise.all([
    Issue.countDocuments(activeMatch),

    Issue.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    Issue.aggregate([
      { $match: activeMatch },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    Issue.aggregate([
      { $match: { ...activeMatch, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Issue.aggregate([
      { $match: { ...activeMatch, status: 'resolved', resolvedAt: { $ne: null } } },
      {
        $project: {
          resolutionHours: {
            $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avgHours: { $avg: '$resolutionHours' } } },
    ]),

    // Thống kê theo quận: một lần $group trên field district đã chuẩn hoá,
    // thay cho 2 countDocuments($regex) mỗi quận (14 query quét toàn bảng).
    Issue.aggregate([
      { $match: activeMatch },
      {
        $group: {
          _id: '$district',
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        },
      },
    ]),

    // Rating stats
    Issue.aggregate([
      { $match: { ...activeMatch, 'rating.score': { $ne: null } } },
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

  // Giữ nguyên đủ 7 quận kể cả khi chưa có sự cố nào, để chart không bị nhảy cột.
  const districtCounts = new Map(districtAgg.map((d) => [d._id, d]));
  const issuesByDistrict = DA_NANG_DISTRICTS.map((district) => {
    const found = districtCounts.get(district);
    const total = found?.total || 0;
    const resolved = found?.resolved || 0;
    return { district, total, resolved, rate: total > 0 ? Math.round((resolved / total) * 100) : 0 };
  });

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
