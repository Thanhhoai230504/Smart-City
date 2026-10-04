const express = require('express');
const validate = require('../middleware/validate');
const {
  authMiddleware, adminMiddleware, staffMiddleware, optionalAuthMiddleware,
} = require('../middleware/auth');
const {
  createDepartmentValidator,
  updateDepartmentValidator,
  assignStaffValidator,
  performanceQueryValidator,
  createEvaluationValidator,
  revokeEvaluationValidator,
  evaluationListValidator,
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
  getDepartmentPerformance,
  getDepartmentPerformanceDetail,
  createDepartmentEvaluation,
  getDepartmentEvaluations,
  revokeDepartmentEvaluation,
} = require('../controllers/departmentController');

const router = express.Router();

// Danh sách đơn vị là thông tin công khai: người dân cần biết đơn vị nào
// phụ trách loại sự cố nào (thay cho danh sách hardcode ở frontend trước đây).
// @route   GET /api/departments
router.get('/', optionalAuthMiddleware, getDepartments);

// @route   GET /api/departments/stats (admin) — bảng hiệu suất xử lý theo đơn vị
router.get('/stats', authMiddleware, adminMiddleware, getDepartmentStats);

// Đánh giá đơn vị theo kỳ (khen thưởng / phê bình) — đặt TRƯỚC '/:id'.
// @route   GET /api/departments/performance?from=&to=
router.get('/performance', authMiddleware, adminMiddleware, performanceQueryValidator, validate, getDepartmentPerformance);
// @route   GET /api/departments/:id/performance?from=&to=
router.get('/:id/performance', authMiddleware, adminMiddleware, performanceQueryValidator, validate, getDepartmentPerformanceDetail);

// Quyết định khen thưởng / phê bình: quản trị viên ghi và huỷ (không sửa, không xoá);
// cán bộ xem được quyết định về đơn vị mình — service kiểm tra đúng đơn vị.
// @route   GET /api/departments/:id/evaluations
router.get('/:id/evaluations', authMiddleware, staffMiddleware, evaluationListValidator, validate, getDepartmentEvaluations);
// @route   POST /api/departments/:id/evaluations (admin)
router.post('/:id/evaluations', authMiddleware, adminMiddleware, createEvaluationValidator, validate, createDepartmentEvaluation);
// @route   POST /api/departments/:id/evaluations/:evaluationId/revoke (admin)
router.post(
  '/:id/evaluations/:evaluationId/revoke',
  authMiddleware,
  adminMiddleware,
  revokeEvaluationValidator,
  validate,
  revokeDepartmentEvaluation
);

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
