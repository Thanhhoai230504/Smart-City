const Issue = require('../models/Issue');
const User = require('../models/User');
const Place = require('../models/Place');

/**
 * @desc    Get dashboard statistics
 * @route   GET /api/dashboard/stats
 * @access  Private (Admin)
 */
const getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Execute all aggregations in parallel
    const [
      totalIssues,
      issuesToday,
      issuesThisWeek,
      issuesThisMonth,
      issuesByStatus,
      issuesByCategory,
      issuesTrend,
      totalUsers,
      totalPlaces,
      recentIssues
    ] = await Promise.all([
      // Total issues count
      Issue.countDocuments(),

      // Issues today
      Issue.countDocuments({ createdAt: { $gte: today } }),

      // Issues this week
      Issue.countDocuments({ createdAt: { $gte: thisWeek } }),

      // Issues this month
      Issue.countDocuments({ createdAt: { $gte: thisMonth } }),

      // Issues grouped by status (pie chart)
      Issue.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      // Issues grouped by category (bar chart)
      Issue.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Issues trend - last 30 days (line chart)
      Issue.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Total registered users
      User.countDocuments(),

      // Total places
      Place.countDocuments({ isActive: true }),

      // 5 most recent issues
      Issue.find()
        .populate('userId', 'name email')
        .sort('-createdAt')
        .limit(5)
        .select('title category status location createdAt')
    ]);

    // Format status data
    const statusMap = {
      reported: 0,
      processing: 0,
      resolved: 0,
      rejected: 0
    };
    issuesByStatus.forEach(item => {
      statusMap[item._id] = item.count;
    });

    // Format category labels (Vietnamese)
    const categoryLabels = {
      pothole: 'Ổ gà',
      garbage: 'Rác thải',
      streetlight: 'Đèn đường hỏng',
      flooding: 'Ngập nước',
      tree: 'Cây đổ',
      other: 'Khác'
    };

    res.json({
      success: true,
      data: {
        overview: {
          totalIssues,
          issuesToday,
          issuesThisWeek,
          issuesThisMonth,
          totalUsers,
          totalPlaces
        },
        issuesByStatus: statusMap,
        issuesByCategory: issuesByCategory.map(item => ({
          category: item._id,
          label: categoryLabels[item._id] || item._id,
          count: item.count
        })),
        issuesTrend: issuesTrend.map(item => ({
          date: item._id,
          count: item.count
        })),
        recentIssues
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats };
