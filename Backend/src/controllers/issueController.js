const issueService = require('../services/issueService');
const Issue = require('../models/Issue');

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

const deleteMyIssue = async (req, res, next) => {
  try {
    await issueService.deleteMyIssue(req.params.id, req.user.id);
    res.json({ success: true, message: 'Issue deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const updateMyIssue = async (req, res, next) => {
  try {
    const issue = await issueService.updateMyIssue(req.params.id, req.user.id, req.body);
    res.json({ success: true, message: 'Issue updated.', data: { issue } });
  } catch (error) {
    next(error);
  }
};

const toggleVote = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    const userId = req.user.id;
    const idx = issue.votes.indexOf(userId);
    if (idx > -1) {
      issue.votes.splice(idx, 1);
    } else {
      issue.votes.push(userId);
    }
    issue.voteCount = issue.votes.length;
    await issue.save();
    res.json({ success: true, data: { voted: idx === -1, voteCount: issue.voteCount } });
  } catch (error) { next(error); }
};

module.exports = { getIssues, getIssueById, createIssue, updateIssueStatus, deleteIssue, getMyIssues, deleteMyIssue, updateMyIssue, toggleVote };
