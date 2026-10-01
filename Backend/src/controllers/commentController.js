const commentService = require('../services/commentService');
const auditService = require('../services/auditService');

const getComments = async (req, res, next) => {
  try {
    const data = await commentService.getComments(req.params.issueId, req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const comment = await commentService.addComment(req.params.issueId, {
      content: req.body.content,
      user: req.user
    });
    res.status(201).json({ success: true, data: { comment } });
  } catch (error) {
    next(error);
  }
};

/** Admin ẩn một bình luận vi phạm (G16). */
const hideComment = async (req, res, next) => {
  try {
    const comment = await commentService.hideComment(req.params.commentId, {
      reason: req.body.reason,
      actor: req.user,
    });
    await auditService.recordAudit({
      actor: req.user,
      action: 'comment.hidden',
      entityType: 'Comment',
      entityId: comment._id,
      description: `Ẩn bình luận trên sự cố ${comment.issueId}`,
      metadata: { reason: req.body.reason || '' },
      request: req,
    });
    res.json({ success: true, message: 'Đã ẩn bình luận.' });
  } catch (error) {
    next(error);
  }
};

/** Hiện lại bình luận bị ẩn nhầm. */
const restoreComment = async (req, res, next) => {
  try {
    const comment = await commentService.restoreComment(req.params.commentId);
    await auditService.recordAudit({
      actor: req.user,
      action: 'comment.restored',
      entityType: 'Comment',
      entityId: comment._id,
      description: `Hiện lại bình luận trên sự cố ${comment.issueId}`,
      request: req,
    });
    res.json({ success: true, message: 'Đã hiện lại bình luận.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  hideComment,
  restoreComment, getComments, addComment };
