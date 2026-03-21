const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getComments, addComment } = require('../controllers/commentController');

const router = express.Router({ mergeParams: true });

// @route   GET /api/issues/:issueId/comments
router.get('/', getComments);

// @route   POST /api/issues/:issueId/comments
router.post('/', authMiddleware, addComment);

module.exports = router;
