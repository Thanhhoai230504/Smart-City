const commentService = require('../services/commentService');

const getComments = async (req, res, next) => {
  try {
    const comments = await commentService.getComments(req.params.issueId);
    res.json({ success: true, data: { comments } });
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

module.exports = { getComments, addComment };
