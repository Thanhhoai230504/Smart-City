const mongoose = require('mongoose');
const User = require('../models/User');
const Issue = require('../models/Issue');
const ApiError = require('../utils/apiError');
const { getBadgesForCount } = require('../utils/badgeConfig');
const { parsePagination } = require('../utils/pagination');
const sessionService = require('./sessionService');
const { releaseOpenAssignments } = require('./departmentService');
const { disconnectUserSockets } = require('../config/socket');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getUsers = async ({
  role,
  isActive,
  departmentId,
  search,
  page = 1,
  limit = 10,
}) => {
  const filter = {};
  if (['user', 'staff', 'admin'].includes(role)) filter.role = role;
  if (isActive !== undefined && isActive !== '') {
    filter.isActive = isActive === true || isActive === 'true';
  }
  if (departmentId) {
    filter.departmentId = mongoose.isValidObjectId(departmentId)
      ? departmentId
      : { $in: [] };
  }
  if (typeof search === 'string' && search.trim()) {
    const pattern = new RegExp(escapeRegExp(search.trim()), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const { pageNum, limitNum, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 10, maxLimit: 100 }
  );

  const [users, total] = await Promise.all([
    User.find(filter).sort('-createdAt').skip(skip).limit(limitNum),
    User.countDocuments(filter),
  ]);

  // Aggregate issue counts per user
  const userIds = users.map(u => u._id);
  const issueCounts = await Issue.aggregate([
    { $match: { userId: { $in: userIds }, isDeleted: false } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const countMap = {};
  issueCounts.forEach(ic => { countMap[ic._id.toString()] = ic.count; });

  const enrichedUsers = users.map(u => {
    const userObj = u.toJSON();
    const issueCount = countMap[u._id.toString()] || 0;
    const badges = getBadgesForCount(issueCount);
    const topBadge = badges.length > 0 ? badges[badges.length - 1] : null;
    return { ...userObj, issueCount, topBadge };
  });

  return {
    users: enrichedUsers,
    pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum },
  };
};

const updateUserRole = async (targetId, role, currentUserId) => {
  if (!['user', 'admin'].includes(role)) {
    throw ApiError.badRequest('Vai trò chỉ được là "Người dùng" hoặc "Quản trị viên".');
  }

  // So sánh qua String(): targetId là chuỗi từ req.params, currentUserId là ObjectId.
  if (String(targetId) === String(currentUserId)) {
    throw ApiError.badRequest('Không thể tự đổi vai trò của chính mình.');
  }

  // 'user' và 'admin' không thuộc đơn vị nào (cán bộ chỉ được tạo qua gán đơn vị). Trước
  // đây hạ cán bộ xuống người dùng vẫn giữ departmentId cũ, còn phiếu họ đứng tên thì treo.
  const user = await User.findByIdAndUpdate(targetId, { role, departmentId: null }, { new: true });
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng.');
  await releaseOpenAssignments(user._id);
  // HTTP đọc lại vai trò mỗi request, nhưng socket giữ vai trò lúc bắt tay.
  disconnectUserSockets(user._id);
  return user;
};

const toggleUserActive = async (targetId, currentUserId) => {
  // So sánh qua String(): targetId là chuỗi từ req.params, currentUserId là ObjectId.
  if (String(targetId) === String(currentUserId)) {
    throw ApiError.badRequest('Không thể tự khoá tài khoản của chính mình.');
  }

  const user = await User.findById(targetId);
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng.');

  user.isActive = !user.isActive;
  await user.save();
  if (!user.isActive) {
    // Khoá thì cắt luôn phiên và kết nối realtime. Trước đây chỉ đảo cờ: mở khoá lại
    // trong vòng 7 ngày thì refresh token cũ dùng tiếp được, còn tab đang mở vẫn
    // nhận thông báo qua socket.
    await sessionService.revokeAllSessions(user._id);
    await releaseOpenAssignments(user._id);
    disconnectUserSockets(user._id);
  }
  return user;
};

module.exports = { getUsers, updateUserRole, toggleUserActive };
