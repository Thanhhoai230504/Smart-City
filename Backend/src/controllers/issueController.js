const issueService = require('../services/issueService');
const ratingService = require('../services/ratingService');
const assignmentService = require('../services/assignmentService');
const duplicateService = require('../services/duplicateService');
const auditService = require('../services/auditService');
const Issue = require('../models/Issue');
const { enqueuePriorityRecalculation } = require('../services/priorityService');

const getIssues = async (req, res, next) => {
  try {
    // Truyền cả người gọi để service tự bó phạm vi cán bộ về đơn vị của họ.
    const data = await issueService.getIssues({ ...req.query, requester: req.user || null });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getIssueById = async (req, res, next) => {
  try {
    // Truyền người gọi để service quyết định có trả `phone`/email hay không.
    const issue = await issueService.getIssueById(req.params.id, req.user || null);
    res.json({ success: true, data: { issue } });
  } catch (error) {
    next(error);
  }
};

const createIssue = async (req, res, next) => {
  try {
    const issue = await issueService.createIssue({
      ...req.body,
      files: req.files,
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
    await auditService.recordAudit({
      actor: req.user,
      action: 'issue.status_changed',
      entityType: 'Issue',
      entityId: issue._id,
      description: `Cập nhật trạng thái "${issue.title}" thành ${req.body.status}`,
      metadata: { status: req.body.status, note: req.body.note || '' },
      request: req,
    });
    res.json({ success: true, message: `Issue status updated to ${req.body.status}.`, data: { issue } });
  } catch (error) {
    next(error);
  }
};

const deleteIssue = async (req, res, next) => {
  try {
    const issue = await issueService.deleteIssue(req.params.id, req.user);
    await auditService.recordAudit({
      actor: req.user,
      action: 'issue.deleted',
      entityType: 'Issue',
      entityId: issue._id,
      description: `Xóa sự cố "${issue.title}"`,
      request: req,
    });
    res.json({ success: true, message: 'Issue deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const getMyIssues = async (req, res, next) => {
  try {
    // Whitelist tường minh thay vì spread `req.query`: client không được gửi
    // `userId` để đọc sự cố của người khác, và `status` chỉ nhận chuỗi nên
    // query parser `qs` không thể biến nó thành toán tử MongoDB.
    const data = await issueService.getMyIssues({
      userId: req.user.id,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getMyIssueSummary = async (req, res, next) => {
  try {
    const summary = await issueService.getMyIssueSummary(req.user.id);
    res.json({ success: true, data: { summary } });
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
    const issue = await Issue.findOne({ _id: req.params.id, isDeleted: false });
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.mergedInto) {
      return res.status(400).json({
        success: false,
        message: 'Báo cáo này đã được gộp. Hãy bình chọn cho sự cố gốc.'
      });
    }
    const userId = req.user.id;
    const idx = issue.votes.indexOf(userId);
    if (idx > -1) {
      issue.votes.splice(idx, 1);
    } else {
      issue.votes.push(userId);
    }
    issue.voteCount = issue.votes.length;
    await issue.save();
    enqueuePriorityRecalculation(issue._id);
    res.json({ success: true, data: { voted: idx === -1, voteCount: issue.voteCount } });
  } catch (error) { next(error); }
};

const rateIssue = async (req, res, next) => {
  try {
    const issue = await ratingService.rateIssue(req.params.id, req.user.id, req.body);
    res.json({ success: true, message: 'Đánh giá thành công!', data: { issue } });
  } catch (error) {
    next(error);
  }
};

const getNearbyIssues = async (req, res, next) => {
  try {
    const { lat, lng, radius = 300 } = req.query;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng are required' });
    const issues = await issueService.getNearbyIssues(parseFloat(lat), parseFloat(lng), parseInt(radius));
    res.json({ success: true, data: { issues } });
  } catch (error) {
    next(error);
  }
};

// ─── Phân công xử lý ───

const assignIssue = async (req, res, next) => {
  try {
    const issue = await assignmentService.assignIssue(req.params.id, req.body, req.user);
    await auditService.recordAudit({
      actor: req.user,
      action: 'issue.assigned',
      entityType: 'Issue',
      entityId: issue._id,
      description: `Phân công sự cố "${issue.title}"`,
      metadata: {
        departmentId: req.body.departmentId,
        assigneeId: req.body.assigneeId || null,
        note: req.body.note || '',
      },
      request: req,
    });
    res.json({ success: true, message: 'Đã phân công sự cố.', data: { issue } });
  } catch (error) {
    next(error);
  }
};

const unassignIssue = async (req, res, next) => {
  try {
    const issue = await assignmentService.unassignIssue(req.params.id, req.body, req.user);
    await auditService.recordAudit({
      actor: req.user,
      action: 'issue.unassigned',
      entityType: 'Issue',
      entityId: issue._id,
      description: `Thu hồi phân công sự cố "${issue.title}"`,
      metadata: { note: req.body.note || '' },
      request: req,
    });
    res.json({ success: true, message: 'Đã thu hồi phân công.', data: { issue } });
  } catch (error) {
    next(error);
  }
};

const claimIssue = async (req, res, next) => {
  try {
    const issue = await assignmentService.claimIssue(req.params.id, req.user);
    await auditService.recordAudit({
      actor: req.user,
      action: 'issue.claimed',
      entityType: 'Issue',
      entityId: issue._id,
      description: `Cán bộ ${req.user.name} nhận xử lý sự cố "${issue.title}"`,
      metadata: { departmentId: req.user.departmentId },
      request: req,
    });
    res.json({ success: true, message: 'Bạn đã nhận xử lý sự cố này.', data: { issue } });
  } catch (error) {
    next(error);
  }
};

const getUnassignedQueue = async (req, res, next) => {
  try {
    const data = await assignmentService.getUnassignedQueue(req.query);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const addResolutionImages = async (req, res, next) => {
  try {
    const resolutionImages = await issueService.addResolutionImages(
      req.params.id,
      req.files,
      req.user
    );
    res.json({
      success: true,
      message: 'Đã tải lên ảnh minh chứng.',
      data: { resolutionImages }
    });
  } catch (error) {
    next(error);
  }
};

const confirmDuplicate = async (req, res, next) => {
  try {
    const result = await duplicateService.confirmDuplicate(req.params.id, req.user.id);
    res.json({
      success: true,
      message: result.alreadyConfirmed
        ? 'Bạn đã xác nhận sự cố này trước đó.'
        : 'Đã xác nhận đây là cùng một sự cố.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const mergeIssue = async (req, res, next) => {
  try {
    const result = await duplicateService.mergeIssue(
      req.params.id,
      req.body.targetIssueId,
      req.user
    );
    await auditService.recordAudit({
      actor: req.user,
      action: 'issue.merged',
      entityType: 'Issue',
      entityId: result.sourceIssueId,
      description: `Gộp báo cáo trùng vào "${result.targetIssue.title}"`,
      metadata: { targetIssueId: result.targetIssue._id },
      request: req,
    });
    res.json({
      success: true,
      message: 'Đã gộp báo cáo trùng vào sự cố gốc.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
