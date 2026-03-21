const userService = require('../services/userService');

const getUsers = async (req, res, next) => {
  try {
    const data = await userService.getUsers(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const user = await userService.updateUserRole(req.params.id, req.body.role, req.user.id);
    res.json({ success: true, message: `Role updated to ${req.body.role}`, data: { user } });
  } catch (error) {
    next(error);
  }
};

const toggleUserActive = async (req, res, next) => {
  try {
    const user = await userService.toggleUserActive(req.params.id, req.user.id);
    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}`, data: { user } });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, updateUserRole, toggleUserActive };
