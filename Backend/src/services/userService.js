const User = require('../models/User');
const ApiError = require('../utils/apiError');

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

  return {
    users,
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
