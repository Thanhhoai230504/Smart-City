const User = require('../models/User');
const Issue = require('../models/Issue');
const ApiError = require('../utils/apiError');
const { getBadgesForCount } = require('../utils/badgeConfig');
const { parsePagination } = require('../utils/pagination');

const getUsers = async ({ role, isActive, page = 1, limit = 10 }) => {
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const { pageNum, limitNum, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 10, maxLimit: 100 }
  );

  const [users, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(limitNum),
    User.countDocuments(filter),
  ]);

  // Aggregate issue counts per user
  const userIds = users.map(u => u._id);
  const issueCounts = await Issue.aggregate([
    { $match: { userId: { $in: userIds }, isDeleted: false } },
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

  // So sánh qua String(): targetId là chuỗi từ req.params, currentUserId là ObjectId.
  if (String(targetId) === String(currentUserId)) {
    throw ApiError.badRequest('Cannot change your own role');
  }

  const user = await User.findByIdAndUpdate(targetId, { role }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const toggleUserActive = async (targetId, currentUserId) => {
  // So sánh qua String(): targetId là chuỗi từ req.params, currentUserId là ObjectId.
  if (String(targetId) === String(currentUserId)) {
    throw ApiError.badRequest('Cannot deactivate your own account');
  }

  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('User not found');

  user.isActive = !user.isActive;
  await user.save();
  return user;
};

module.exports = { getUsers, updateUserRole, toggleUserActive };
