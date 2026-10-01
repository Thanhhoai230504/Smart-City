const express = require('express');
const { body } = require('express-validator');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getComments,
  addComment,
  hideComment,
  restoreComment,
} = require('../controllers/commentController');

const router = express.Router({ mergeParams: true });

// @route   GET /api/issues/:issueId/comments
router.get('/', getComments);

// @route   POST /api/issues/:issueId/comments
router.post('/', authMiddleware, addComment);

// Kiểm duyệt (G16) — CHỈ admin. Cán bộ không được tự gỡ phản ánh về đơn vị của
// mình (xung đột lợi ích), và người viết cũng không tự xoá được vì làm vậy sẽ
// đứt mạch hội thoại sau khi cán bộ đã trả lời.
// @route   DELETE /api/issues/:issueId/comments/:commentId
router.delete(
  '/:commentId',
  authMiddleware,
  adminMiddleware,
  body('reason')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 300 }).withMessage('Lý do không quá 300 ký tự'),
  validate,
  hideComment
);

// @route   POST /api/issues/:issueId/comments/:commentId/restore
router.post('/:commentId/restore', authMiddleware, adminMiddleware, restoreComment);

module.exports = router;
