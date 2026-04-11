const User = require('../models/User');
const Issue = require('../models/Issue');
const ApiError = require('../utils/apiError');
const { getBadgesForCount } = require('../utils/badgeConfig');

const getUsers = async ({ role, isActive, page = 1, limit = 10 }) => {
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(limitNum),
    User.countDocuments(filter),
  ]);

  // Aggregate issue counts per user
  const userIds = users.map(u => u._id);
  const issueCounts = await Issue.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  issueCounts.forEach(ic => { countMap[ic._id.toString()] = ic.count; });

  const enrichedUsers = users.map(u => {
    const userObj = u.toJSON();
    const issueCount = countMap[u._id.toString()] || 0;
    const badges = getBadgesForCount(issueCount);
    const topBadge = badges.length > 0 ? badges[badges.length - 1] : null;
    return { ...userObj, issueCount, topBadge };
  });

  return {
    users: enrichedUsers,
    pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum },
  };
};

const updateUserRole = async (targetId, role, currentUserId) => {
  if (!['user', 'admin'].includes(role)) {
    throw ApiError.badRequest('Role must be user or admin');
  }

  if (targetId === currentUserId) {
    throw ApiError.badRequest('Cannot change your own role');
  }

  const user = await User.findByIdAndUpdate(targetId, { role }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const toggleUserActive = async (targetId, currentUserId) => {
  if (targetId === currentUserId) {
    throw ApiError.badRequest('Cannot deactivate your own account');
  }

  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('User not found');

  user.isActive = !user.isActive;
  await user.save();
  return user;
};

module.exports = { getUsers, updateUserRole, toggleUserActive };
