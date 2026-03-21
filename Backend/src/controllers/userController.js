const User = require('../models/User');
const ApiError = require('../utils/apiError');

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/users
 * @access  Private (Admin)
 */
const getUsers = async (req, res, next) => {
  try {
    const { role, isActive, page = 1, limit = 10 } = req.query;

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

    res.json({
      success: true,
      data: {
        users,
        pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user role (admin only)
 * @route   PATCH /api/users/:id/role
 * @access  Private (Admin)
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      throw ApiError.badRequest('Role must be user or admin');
    }

    // Prevent self role change
    if (req.params.id === req.user.id) {
      throw ApiError.badRequest('Cannot change your own role');
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) throw ApiError.notFound('User not found');

    res.json({ success: true, message: `Role updated to ${role}`, data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle user active status (admin only)
 * @route   PATCH /api/users/:id/toggle-active
 * @access  Private (Admin)
 */
const toggleUserActive = async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      throw ApiError.badRequest('Cannot deactivate your own account');
    }

    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User not found');

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: { user } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, updateUserRole, toggleUserActive };
