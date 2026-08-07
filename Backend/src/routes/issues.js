const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authMiddleware, adminMiddleware, staffMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const uploadImages = require('../middleware/uploadImages');
const {
  createIssueValidator,
  updateIssueStatusValidator,
  duplicateCandidateValidator,
} = require('../validators/issueValidator');
const { duplicateCandidateLimiter } = require('../middleware/rateLimiters');
const { assignIssueValidator } = require('../validators/departmentValidator');
// Dùng chung giới hạn số ảnh với validator của model, không khai lại con số.
const Issue = require('../models/Issue');
const {
  getPriorityConfig,
  recalculatePriority,
  recalculatePriorityBatch,
} = require('../controllers/priorityController');
const {
  getDuplicateConfig,
  getMetrics,
  getDuplicateCandidates,
  getDuplicateCandidatesForIssue,
} = require('../controllers/duplicateController');
const {
  getIssues,
  getIssueById,
  createIssue,
  updateIssueStatus,
  deleteIssue,
  getMyIssues,
  getMyIssueSummary,
  deleteMyIssue,
  updateMyIssue,
  toggleVote,
  rateIssue,
  getNearbyIssues,
  assignIssue,
  unassignIssue,
  claimIssue,
  getUnassignedQueue,
  addResolutionImages,
  confirmDuplicate,
  mergeIssue
} = require('../controllers/issueController');

const router = express.Router();
const uploadIssueImages = uploadImages('images', Issue.MAX_ISSUE_IMAGES);

// Danh sách công khai, nhưng nhận diện người gọi nếu có token: cán bộ chỉ
// được thấy sự cố của đơn vị mình (service tự bó phạm vi theo req.user).
// @route   GET /api/issues
router.get('/', optionalAuthMiddleware, getIssues);

// @route   GET /api/issues/nearby?lat=...&lng=...&radius=300
router.get('/nearby', getNearbyIssues);

// Danh sách làm việc của cán bộ phải dùng xác thực bắt buộc. Không dùng route công khai
// phía trên để token hết hạn luôn trả 401 (client có thể refresh token) thay vì vô tình
// rơi về phạm vi khách và thấy danh sách toàn hệ thống.
// @route   GET /api/issues/work (admin + staff)
router.get('/work', authMiddleware, staffMiddleware, getIssues);

// @route   GET /api/issues/my (must be before /:id to avoid conflict)
router.get('/my/summary', authMiddleware, getMyIssueSummary);
router.get('/my', authMiddleware, getMyIssues);

// Hàng chờ chưa phân công — màn hình làm việc của admin.
// Phải đứng trước /:id để không bị nuốt thành param.
// @route   GET /api/issues/queue/unassigned (admin only)
router.get('/queue/unassigned', authMiddleware, adminMiddleware, getUnassignedQueue);

// Cấu hình minh bạch và thao tác tính lại chỉ dành cho quản trị viên.
router.get('/priority/config', authMiddleware, adminMiddleware, getPriorityConfig);
router.post('/priority/recalculate', authMiddleware, adminMiddleware, recalculatePriorityBatch);

router.get('/duplicate/config', authMiddleware, getDuplicateConfig);
router.get('/duplicate/metrics', authMiddleware, adminMiddleware, getMetrics);
router.post(
  '/duplicate-candidates',
  authMiddleware,
  duplicateCandidateLimiter,
  duplicateCandidateValidator,
  validate,
  getDuplicateCandidates
);

// Chi tiết sự cố vẫn công khai, nhưng nhận diện người gọi nếu có token: chỉ
// admin và cán bộ mới được thấy `phone` của người báo cáo và email người dùng.
// @route   GET /api/issues/:id
router.get('/:id', optionalAuthMiddleware, getIssueById);

// @route   POST /api/issues
router.post(
  '/',
  authMiddleware,
  uploadIssueImages,
  createIssueValidator,
  validate,
  createIssue
);

// Cán bộ cũng cập nhật được trạng thái, nhưng service chặn nếu sự cố không
// thuộc đơn vị của họ (assertCanHandleIssue).
// @route   PATCH /api/issues/:id/status (admin + staff)
router.patch(
  '/:id/status',
  authMiddleware,
  staffMiddleware,
  updateIssueStatusValidator,
  validate,
  updateIssueStatus
);

// @route   POST /api/issues/:id/assign (admin only) — phân công cho đơn vị
router.post(
  '/:id/assign',
  authMiddleware,
  adminMiddleware,
  assignIssueValidator,
  validate,
  assignIssue
);

// @route   POST /api/issues/:id/unassign (admin only) — thu hồi phân công
router.post('/:id/unassign', authMiddleware, adminMiddleware, unassignIssue);

// @route   POST /api/issues/:id/claim (staff) — cán bộ tự nhận việc
router.post('/:id/claim', authMiddleware, staffMiddleware, claimIssue);

router.post('/:id/recalculate-priority', authMiddleware, adminMiddleware, recalculatePriority);
router.get(
  '/:id/duplicate-candidates',
  authMiddleware,
  adminMiddleware,
  duplicateCandidateLimiter,
  getDuplicateCandidatesForIssue
);

// Ảnh minh chứng sau xử lý. Phải upload trước khi chuyển sang "resolved" —
// service chặn nếu chưa có ảnh nào.
// @route   POST /api/issues/:id/resolution-images (admin + staff)
router.post(
  '/:id/resolution-images',
  authMiddleware,
  staffMiddleware,
  uploadIssueImages,
  addResolutionImages
);

// Người dân xác nhận một báo cáo gần đó chính là sự cố họ định gửi.
// @route   POST /api/issues/:id/confirm-duplicate
router.post('/:id/confirm-duplicate', authMiddleware, confirmDuplicate);

// Admin hợp nhất bản trùng (`:id`) vào bản gốc (`targetIssueId`).
// @route   POST /api/issues/:id/merge
router.post(
  '/:id/merge',
  authMiddleware,
  adminMiddleware,
  body('targetIssueId').isMongoId().withMessage('targetIssueId không hợp lệ'),
  validate,
  mergeIssue
);

// @route   PUT /api/issues/:id/my — user edit own issue
router.put('/:id/my', authMiddleware, updateMyIssue);

// @route   DELETE /api/issues/:id/my — user delete own issue
router.delete('/:id/my', authMiddleware, deleteMyIssue);

// @route   DELETE /api/issues/:id (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, deleteIssue);

// @route   POST /api/issues/:id/vote
router.post('/:id/vote', authMiddleware, toggleVote);

// @route   POST /api/issues/:id/rate
router.post('/:id/rate', authMiddleware, rateIssue);

module.exports = router;
