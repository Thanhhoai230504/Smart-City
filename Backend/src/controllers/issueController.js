const issueService = require('../services/issueService');

const getIssues = async (req, res, next) => {
  try {
    const data = await issueService.getIssues(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getIssueById = async (req, res, next) => {
  try {
    const issue = await issueService.getIssueById(req.params.id);
    res.json({ success: true, data: { issue } });
  } catch (error) {
    next(error);
  }
};

const createIssue = async (req, res, next) => {
  try {
    const issue = await issueService.createIssue({
      ...req.body,
      file: req.file,
      user: req.user
    });
    res.status(201).json({ success: true, message: 'Issue reported successfully.', data: { issue } });
  } catch (error) {
    next(error);
  }
};

const updateIssueStatus = async (req, res, next) => {
  try {
    const issue = await issueService.updateIssueStatus(req.params.id, {
      status: req.body.status,
      note: req.body.note,
      adminUser: req.user
    });
    res.json({ success: true, message: `Issue status updated to ${req.body.status}.`, data: { issue } });
  } catch (error) {
    next(error);
  }
};

const deleteIssue = async (req, res, next) => {
  try {
    await issueService.deleteIssue(req.params.id);
    res.json({ success: true, message: 'Issue deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const getMyIssues = async (req, res, next) => {
  try {
    const data = await issueService.getMyIssues({ userId: req.user.id, ...req.query });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getIssues, getIssueById, createIssue, updateIssueStatus, deleteIssue, getMyIssues };
