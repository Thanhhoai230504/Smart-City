const express = require('express');
const validate = require('../middleware/validate');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createIssueValidator, updateIssueStatusValidator } = require('../validators/issueValidator');
const {
  getIssues,
  getIssueById,
  createIssue,
  updateIssueStatus,
  deleteIssue,
  getMyIssues,
  deleteMyIssue,
  updateMyIssue,
  toggleVote
} = require('../controllers/issueController');

const router = express.Router();

// @route   GET /api/issues
router.get('/', getIssues);

// @route   GET /api/issues/my (must be before /:id to avoid conflict)
router.get('/my', authMiddleware, getMyIssues);

// @route   GET /api/issues/:id
router.get('/:id', getIssueById);

// @route   POST /api/issues
router.post(
  '/',
  authMiddleware,
  upload.single('image'),
  createIssueValidator,
  validate,
  createIssue
);

// @route   PATCH /api/issues/:id/status (admin only)
router.patch(
  '/:id/status',
  authMiddleware,
  adminMiddleware,
  updateIssueStatusValidator,
  validate,
  updateIssueStatus
);

// @route   PUT /api/issues/:id/my — user edit own issue
router.put('/:id/my', authMiddleware, updateMyIssue);

// @route   DELETE /api/issues/:id/my — user delete own issue
router.delete('/:id/my', authMiddleware, deleteMyIssue);

// @route   DELETE /api/issues/:id (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, deleteIssue);

// @route   POST /api/issues/:id/vote
router.post('/:id/vote', authMiddleware, toggleVote);

module.exports = router;
