const departmentService = require('../services/departmentService');
const auditService = require('../services/auditService');

const getDepartments = async (req, res, next) => {
  try {
    // Chỉ admin được xem cả đơn vị đã vô hiệu hoá.
    const includeInactive = req.user?.role === 'admin' && req.query.includeInactive === 'true';
    const departments = await departmentService.getDepartments({
      includeInactive,
      category: req.query.category || null,
    });
    res.json({ success: true, data: { departments } });
  } catch (error) {
    next(error);
  }
};

const getDepartmentById = async (req, res, next) => {
  try {
    const department = await departmentService.getDepartmentById(req.params.id);
    res.json({ success: true, data: { department } });
  } catch (error) {
    next(error);
  }
};

const createDepartment = async (req, res, next) => {
  try {
    const department = await departmentService.createDepartment(req.body);
    res.status(201).json({ success: true, message: 'Đã tạo đơn vị.', data: { department } });
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const department = await departmentService.updateDepartment(req.params.id, req.body);
    res.json({ success: true, message: 'Đã cập nhật đơn vị.', data: { department } });
  } catch (error) {
    next(error);
  }
};

const deactivateDepartment = async (req, res, next) => {
  try {
    const department = await departmentService.deactivateDepartment(req.params.id);
    res.json({ success: true, message: 'Đã vô hiệu hoá đơn vị.', data: { department } });
  } catch (error) {
    next(error);
  }
};

const getDepartmentStaff = async (req, res, next) => {
  try {
    const staff = await departmentService.getDepartmentStaff(req.params.id);
    res.json({ success: true, data: { staff } });
  } catch (error) {
    next(error);
  }
};

const assignStaffToDepartment = async (req, res, next) => {
  try {
    const user = await departmentService.assignStaffToDepartment(
      req.params.userId,
      req.body.departmentId
    );
    await auditService.recordAudit({
      actor: req.user,
      action: 'department.staff_changed',
      entityType: 'User',
      entityId: user._id,
      description: req.body.departmentId
        ? `Gán ${user.email} vào đơn vị xử lý`
        : `Bỏ ${user.email} khỏi đơn vị xử lý`,
      metadata: {
        departmentId: req.body.departmentId || null,
        resultingRole: user.role,
      },
      request: req,
    });
    res.json({ success: true, message: 'Đã cập nhật đơn vị của người dùng.', data: { user } });
  } catch (error) {
    next(error);
  }
};

const getDepartmentStats = async (req, res, next) => {
  try {
    const stats = await departmentService.getDepartmentStats();
    res.json({ success: true, data: { stats } });
  } catch (error) {
    next(error);
  }
};

const suggestDepartment = async (req, res, next) => {
  try {
    const departments = await departmentService.suggestDepartment(req.params.category);
    res.json({ success: true, data: { departments } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  getDepartmentStaff,
  assignStaffToDepartment,
  getDepartmentStats,
  suggestDepartment,
};
