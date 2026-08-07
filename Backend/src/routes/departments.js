const express = require('express');
const validate = require('../middleware/validate');
const { authMiddleware, adminMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const {
  createDepartmentValidator,
  updateDepartmentValidator,
  assignStaffValidator,
} = require('../validators/departmentValidator');
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  getDepartmentStaff,
  assignStaffToDepartment,
  getDepartmentStats,
  suggestDepartment,
} = require('../controllers/departmentController');

const router = express.Router();

// Danh sách đơn vị là thông tin công khai: người dân cần biết đơn vị nào
// phụ trách loại sự cố nào (thay cho danh sách hardcode ở frontend trước đây).
// @route   GET /api/departments
router.get('/', optionalAuthMiddleware, getDepartments);

// @route   GET /api/departments/stats (admin) — bảng hiệu suất xử lý theo đơn vị
router.get('/stats', authMiddleware, adminMiddleware, getDepartmentStats);

// @route   GET /api/departments/suggest/:category — gợi ý đơn vị khi phân công
router.get('/suggest/:category', authMiddleware, adminMiddleware, suggestDepartment);

// @route   GET /api/departments/:id
router.get('/:id', getDepartmentById);

// @route   GET /api/departments/:id/staff (admin)
router.get('/:id/staff', authMiddleware, adminMiddleware, getDepartmentStaff);

// @route   POST /api/departments (admin)
router.post('/', authMiddleware, adminMiddleware, createDepartmentValidator, validate, createDepartment);

// @route   PUT /api/departments/:id (admin)
router.put('/:id', authMiddleware, adminMiddleware, updateDepartmentValidator, validate, updateDepartment);

// Không xoá cứng: cán bộ và sự cố đang trỏ tới đơn vị sẽ mất tham chiếu.
// @route   DELETE /api/departments/:id (admin) — vô hiệu hoá
router.delete('/:id', authMiddleware, adminMiddleware, deactivateDepartment);

// @route   PUT /api/departments/staff/:userId (admin) — gán/bỏ gán cán bộ
router.put(
  '/staff/:userId',
  authMiddleware,
  adminMiddleware,
  assignStaffValidator,
  validate,
  assignStaffToDepartment
);

module.exports = router;
