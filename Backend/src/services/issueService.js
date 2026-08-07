const Issue = require('../models/Issue');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { getIO } = require('../config/socket');
const cloudinary = require('../config/cloudinary');
const { sendEmail } = require('./emailService');
const { buildStatusChangeEmail, buildRatingRequestEmail } = require('../utils/emailTemplates');
const { DA_NANG_DISTRICTS, normalizeDistrictInput } = require('../utils/districts');
const { assertCanHandleIssue } = require('./assignmentService');
const { parsePagination } = require('../utils/pagination');
const { enqueuePriorityRecalculation } = require('./priorityService');
const { enqueueIssueEmbedding, markIssueEmbeddingPending } = require('./embeddingService');

// Chỉ lấy các field thực sự dùng trên card/danh sách. Các mảng lớn như
// statusHistory, votes, followers, images và resolutionImages chỉ tải ở trang
// chi tiết, tránh payload tăng tuyến tính theo lịch sử của từng sự cố.
const ISSUE_LIST_FIELDS = [
  'title', 'description', 'category', 'location', 'district',
  'latitude', 'longitude', 'imageUrl', 'status', 'userId', 'adminId',
  'resolvedAt', 'voteCount', 'rating', 'departmentId', 'assigneeId',
  'assignedAt', 'dueAt', 'escalationLevel', 'duplicateCount',
  'priorityScore', 'priorityLevel', 'priorityFactors', 'priorityVersion', 'priorityCalculatedAt',
  'createdAt', 'updatedAt',
].join(' ');

const ISSUE_MAP_FIELDS = [
  'title', 'category', 'status', 'location', 'district',
  'latitude', 'longitude', 'imageUrl', 'voteCount', 'createdAt',
].join(' ');

// Giá trị lọc phải thuộc enum của model. Query string có thể mang object
// (?status[$ne]=x) nên `Set.has()` vừa chặn toán tử MongoDB vừa chặn giá trị lạ.
const ALLOWED_STATUSES = new Set(['reported', 'processing', 'resolved', 'rejected']);
const ALLOWED_CATEGORIES = new Set(['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other']);

// Thông tin liên hệ (số điện thoại người báo cáo, email người dùng) chỉ dành cho
// người có trách nhiệm xử lý. Khách và người dân thường chỉ thấy tên.
const canSeeContactInfo = (requester) => (
  requester?.role === 'admin' || requester?.role === 'staff'
);

const ALLOWED_SORTS = new Set([
  '-createdAt',
  'createdAt',
  '-voteCount',
  'voteCount',
  'dueAt',
  '-dueAt',
  '-priorityScore',
  'priorityScore',
]);

// Chỉ nhận ObjectId hợp lệ. Query string dạng ?departmentId[$ne]=null cho ra
// object nên `isValidObjectId` loại bỏ, toán tử MongoDB không lọt vào filter.
// Giá trị sai trả về `{ $in: [] }` (không match gì, không sinh CastError) thay
// vì im lặng bỏ qua filter — cùng cách xử lý với district không hợp lệ.
const parseObjectIdFilter = (value) => (
  mongoose.isValidObjectId(value) ? value : { $in: [] }
);

const parseMapBounds = (bounds) => {
  if (!bounds || typeof bounds !== 'string') return null;
  const values = bounds.split(',').map(Number);
  if (
    values.length !== 4
    || values.some((value) => !Number.isFinite(value))
  ) return null;

  const [west, south, east, north] = values;
  if (
    west < -180 || east > 180 || south < -90 || north > 90
    || west >= east || south >= north
  ) return null;

  return {
    type: 'Polygon',
    coordinates: [[
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south],
    ]],
  };
};

const getIssues = async ({
  status, category, search, district, dateFrom, dateTo,
  departmentId, assigneeId, slaStatus, unassigned, assigned,
  priorityLevel,
  page = 1, limit, sort = '-createdAt',
  view = 'list', bounds,
  // Người gọi. Cán bộ (staff) chỉ được thấy sự cố của đơn vị mình — ràng buộc
  // này áp ở service để mọi route dùng lại đều an toàn, không phụ thuộc
  // controller có nhớ truyền filter hay không.
  requester = null,
} = {}) => {
  // Bản ghi đã gộp vẫn được giữ để audit nhưng không còn là một sự cố độc lập.
  const filter = { isDeleted: false, mergedInto: null };
  // Giá trị không thuộc enum thì trả về rỗng chứ không im lặng bỏ qua filter,
  // cùng cách xử lý với district không hợp lệ.
  if (status) filter.status = ALLOWED_STATUSES.has(status) ? status : '__invalid__';
  if (category) filter.category = ALLOWED_CATEGORIES.has(category) ? category : '__invalid__';
  if (['low', 'medium', 'high', 'critical'].includes(priorityLevel)) {
    filter.priorityLevel = priorityLevel;
  }
  if (search?.trim()) {
    // MongoDB text index tránh quét toàn collection bằng hai biểu thức regex.
    filter.$text = { $search: search.trim() };
  }
  if (district) {
    // Khớp chính xác trên field district đã chuẩn hoá (có index) thay vì
    // $regex trên chuỗi location. Tên quận không hợp lệ thì trả về rỗng
    // chứ không im lặng bỏ qua filter.
    filter.district = normalizeDistrictInput(district) || '__invalid__';
  }
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // ─── Phân công ───
  if (departmentId) filter.departmentId = parseObjectIdFilter(departmentId);
  if (assigneeId) filter.assigneeId = parseObjectIdFilter(assigneeId);
  // Hàng chờ phân công của admin
  if (unassigned === true || unassigned === 'true') {
    filter.departmentId = null;
  } else if (assigned === true || assigned === 'true') {
    filter.departmentId = { $ne: null };
  }

  // Cán bộ luôn bị bó vào đơn vị của mình, ghi đè mọi departmentId client gửi lên.
  if (requester?.role === 'staff') {
    // Middleware của route công việc đã chặn cán bộ chưa có đơn vị. Giữ thêm ràng
    // buộc ở service để các caller khác không thể vô tình trả hàng chờ chưa phân công.
    filter.departmentId = requester.departmentId || { $in: [] };
  }

  const isMapView = view === 'map';
  if (isMapView) {
    // Bản đồ chỉ biểu diễn công việc đang mở và chỉ tải vùng nhìn thấy.
    // Điều này giữ số marker ổn định ngay cả khi DB có hàng triệu bản ghi.
    if (!status) filter.status = { $in: ['reported', 'processing'] };
    const geometry = parseMapBounds(bounds);
    if (geometry) filter.geo = { $geoWithin: { $geometry: geometry } };
  }

  // Lọc theo tình trạng hạn xử lý. `slaStatus` là virtual (tính lúc đọc) nên
  // không query trực tiếp được — phải dịch sang điều kiện trên dueAt.
  const now = new Date();
  if (slaStatus === 'overdue') {
    filter.dueAt = { $ne: null, $lt: now };
    filter.status = !filter.status
      ? { $in: ['reported', 'processing'] }
      : ['reported', 'processing'].includes(filter.status)
        ? filter.status
        : { $in: [] };
  } else if (slaStatus === 'due_soon') {
    // Còn hạn nhưng dưới 12 giờ
    filter.dueAt = { $gte: now, $lte: new Date(now.getTime() + 12 * 60 * 60 * 1000) };
    filter.status = !filter.status
      ? { $in: ['reported', 'processing'] }
      : ['reported', 'processing'].includes(filter.status)
        ? filter.status
        : { $in: [] };
  }

  const { pageNum, limitNum, skip } = parsePagination(
    { page, limit },
    { defaultLimit: isMapView ? 300 : 10, maxLimit: isMapView ? 500 : 100 }
  );
  const safeSort = ALLOWED_SORTS.has(sort) ? sort : '-createdAt';
  // Danh sách công khai không được trả email thật của người báo cáo/cán bộ.
  // Chỉ người có quyền xử lý (admin, cán bộ) mới cần thông tin liên hệ.
  const listUserFields = canSeeContactInfo(requester) ? 'name email' : 'name';

  if (isMapView) {
    const issues = await Issue.find(filter)
      .select(ISSUE_MAP_FIELDS)
      .sort(safeSort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    return {
      issues,
      pagination: {
        current: pageNum,
        // Bản đồ không cần COUNT toàn collection sau mỗi lần kéo/zoom.
        pages: issues.length === limitNum ? pageNum + 1 : pageNum,
        total: issues.length,
        limit: limitNum,
      },
    };
  }

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .select(ISSUE_LIST_FIELDS)
      .populate('userId', listUserFields)
      .populate('adminId', listUserFields)
      .populate('departmentId', 'name code')
      .populate('assigneeId', listUserFields)
      .sort(safeSort)
      .skip(skip)
      .limit(limitNum),
    Issue.countDocuments(filter)
  ]);

  return {
    issues,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum
    }
  };
};

// Route chi tiết là công khai (không bắt đăng nhập), nên mặc định phải che dữ
// liệu cá nhân: `phone` do người báo cáo nhập và email của người dùng. Chỉ
// admin/cán bộ mới cần thông tin liên hệ để xử lý sự cố.
// `requester` mặc định null để mọi caller quên truyền vẫn rơi vào nhánh an toàn.
const getIssueById = async (id, requester = null) => {
  const canSeeContact = canSeeContactInfo(requester);
  const userFields = canSeeContact ? 'name email' : 'name';

  const query = Issue.findOne({ _id: id, isDeleted: false })
    .populate('userId', userFields)
    .populate('adminId', userFields)
    // Đơn vị phụ trách lấy từ DB, thay cho danh sách hardcode ở frontend.
    // Đây là số/email cơ quan công khai, không phải dữ liệu cá nhân — giữ nguyên.
    .populate('departmentId', 'name code email phone')
    .populate('assigneeId', userFields)
    .populate('mergedInto', 'title status')
    .populate('mergedBy', 'name');

  // Loại `phone` ngay ở tầng truy vấn thay vì xoá sau khi đọc, để dữ liệu cá
  // nhân không rời khỏi DB khi người gọi không có quyền thấy nó.
  if (!canSeeContact) query.select('-phone');

  const issue = await query;

  if (!issue) {
    throw ApiError.notFound('Issue not found.');
  }
  return issue;
};

const createIssue = async ({
  title,
  description,
  category,
  location,
  latitude,
  longitude,
  phone,
  files = [],
  // Giữ tương thích cho caller nội bộ/test cũ trong giai đoạn chuyển đổi.
  file = null,
  user
}) => {
  const normalizedFiles = files.length ? files : (file ? [file] : []);
  const uploadedImages = normalizedFiles.map((uploadedFile) => ({
    url: uploadedFile.path,
    publicId: uploadedFile.filename || null,
  }));
  const primaryImage = uploadedImages[0] || null;

  try {
    const issue = await Issue.create({
      title,
      description,
      category,
      location,
      latitude,
      longitude,
      imageUrl: primaryImage?.url || null,
      imagePublicId: primaryImage?.publicId || null,
      images: uploadedImages,
      phone: phone || null,
      userId: user.id,
      followers: [user.id],
      statusHistory: [{
        status: 'reported',
        changedBy: user.id,
        changedAt: new Date(),
        note: 'Sự cố được báo cáo'
      }]
    });

    await issue.populate('userId', 'name email');
    enqueuePriorityRecalculation(issue._id);
    enqueueIssueEmbedding(issue._id);

    // Notify all admins
    try {
      const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id');
      const io = getIO();

      for (const admin of adminUsers) {
        const notification = await Notification.create({
          userId: admin._id,
          type: 'issue_created',
          title: 'Sự cố mới',
          message: `${user.name || 'Người dùng'} đã báo cáo sự cố "${issue.title}"`,
          issueId: issue._id
        });
        io.to(`user_${admin._id}`).emit('notification:new', notification);
      }

      io.to('admins').emit('issue:created', {
        message: `New issue reported: ${issue.title}`,
        issue
      });

      // Notify district watchers — district đã được model chuẩn hoá lúc save
      const issueDistrict = DA_NANG_DISTRICTS.includes(issue.district) ? issue.district : null;

      if (issueDistrict) {
        const watchers = await User.find({
          watchedDistricts: issueDistrict,
          _id: { $ne: user.id },
          isActive: true,
        }).select('_id');

        for (const watcher of watchers) {
          const watchNotif = await Notification.create({
            userId: watcher._id,
            type: 'area_alert',
            title: '📍 Sự cố mới trong khu vực theo dõi',
            message: `Sự cố "${issue.title}" tại ${issue.location}`,
            issueId: issue._id,
          });
          io.to(`user_${watcher._id}`).emit('notification:new', watchNotif);
        }
      }
    } catch (socketError) {
      console.warn('Socket.io/Notification error:', socketError.message);
    }

    return issue;
  } catch (error) {
    // Multer đã upload tất cả file trước khi service ghi MongoDB. Nếu ghi lỗi,
    // phải thu hồi từng ảnh; lỗi xoá một ảnh không được cản việc xoá ảnh sau.
    for (const image of uploadedImages) {
      if (!image.publicId) continue;
      try {
        await cloudinary.uploader.destroy(image.publicId);
        console.log(`🗑️  Rolled back Cloudinary image: ${image.publicId}`);
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup Cloudinary image:', cleanupError.message);
      }
    }
    throw error;
  }
};

const updateIssueStatus = async (issueId, { status, note, adminUser }) => {
  const validStatuses = ['reported', 'processing', 'resolved', 'rejected'];

  if (!status || !validStatuses.includes(status)) {
    throw ApiError.badRequest(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  // Route này mở cho cả cán bộ, nên phải kiểm tra phạm vi đơn vị trước khi ghi:
  // cán bộ đơn vị A không được đổi trạng thái sự cố của đơn vị B.
  const current = await Issue.findOne({ _id: issueId, isDeleted: false })
    .select('departmentId status resolutionImages mergedInto');
  if (!current) {
    throw ApiError.notFound('Issue not found.');
  }
  if (current.mergedInto) {
    throw ApiError.badRequest('Báo cáo này đã được gộp; hãy cập nhật sự cố gốc');
  }
  assertCanHandleIssue(current, adminUser);

  // Bắt buộc ảnh minh chứng khi báo đã xử lý xong — để điểm đánh giá của
  // người dân có căn cứ, không chỉ dựa vào lời khai của đơn vị.
  if (status === 'resolved' && !current.resolutionImages?.length) {
    throw ApiError.badRequest(
      'Cần tải lên ít nhất 1 ảnh minh chứng trước khi chuyển sang "Đã xử lý".'
    );
  }

  const updateData = {
    status,
    adminId: adminUser.id,
    $push: {
      statusHistory: {
        status,
        changedBy: adminUser.id,
        changedAt: new Date(),
        note: note || ''
      }
    }
  };

  if (status === 'resolved') {
    updateData.resolvedAt = new Date();
  }

  const issue = await Issue.findByIdAndUpdate(issueId, updateData, { new: true, runValidators: true })
    .populate('userId', 'name email')
    .populate('adminId', 'name email');

  if (!issue) {
    throw ApiError.notFound('Issue not found.');
  }

  enqueuePriorityRecalculation(issue._id);

  // Create notification for reporter
  const statusLabels = { processing: 'Đang xử lý', resolved: 'Đã xử lý', rejected: 'Từ chối' };
  try {
    const io = getIO();
    const reporterId = issue.userId._id || issue.userId;
    const recipientIds = new Map([
      reporterId,
      ...(issue.followers || []),
    ].filter(Boolean).map((id) => {
      const rawId = id._id || id;
      return [rawId.toString(), rawId];
    }));

    for (const recipientId of recipientIds.values()) {
      const notification = await Notification.create({
        userId: recipientId,
        type: status === 'resolved' ? 'issue_resolved' : status === 'rejected' ? 'issue_rejected' : 'issue_updated',
        title: `Sự cố ${statusLabels[status] || status}`,
        message: `Sự cố "${issue.title}" đã được cập nhật trạng thái: ${statusLabels[status] || status}`,
        issueId: issue._id
      });
      io.to(`user_${recipientId}`).emit('notification:new', notification);
      io.to(`user_${recipientId}`).emit('issue:updated', { message: notification.message, issue });

      if (status === 'resolved') {
        io.to(`user_${recipientId}`).emit('issue:resolved', { message: notification.message, issue });
      }
    }
  } catch (socketError) {
    console.warn('Socket/Notification error:', socketError.message);
  }

  // Gửi email thông báo cho người báo cáo
  try {
    const reporterId = issue.userId._id || issue.userId;
    const reporterUser = await User.findById(reporterId).select('email name');
    if (reporterUser?.email) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      const emailHtml = buildStatusChangeEmail({
        userName: reporterUser.name,
        issueTitle: issue.title,
        newStatus: status,
        note: note || '',
        issueId: issue._id,
        clientUrl,
      });
      sendEmail(reporterUser.email, `Sự cố "${issue.title}" — ${statusLabels[status] || status}`, emailHtml);

      // Gửi thêm email mời đánh giá nếu đã xử lý xong
      if (status === 'resolved') {
        const ratingHtml = buildRatingRequestEmail({
          userName: reporterUser.name,
          issueTitle: issue.title,
          issueId: issue._id,
          clientUrl,
        });
        sendEmail(reporterUser.email, `⭐ Đánh giá chất lượng xử lý: "${issue.title}"`, ratingHtml);
      }
    }
  } catch (emailErr) {
    console.warn('Email notification error:', emailErr.message);
  }

  return issue;
};

/**
 * Xoá ảnh trên Cloudinary. Không throw để việc xoá sự cố không bị fail
 * chỉ vì Cloudinary lỗi — chỉ log lại cảnh báo.
 */
const destroyIssueImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️  Deleted Cloudinary image: ${publicId}`);
  } catch (err) {
    console.error('⚠️  Failed to delete Cloudinary image:', err.message);
  }
};

/**
 * Gom public_id của mọi ảnh thuộc một sự cố (ảnh đơn cũ, images[], ảnh minh
 * chứng) rồi dedupe — `imagePublicId` luôn trùng phần tử đầu của `images[]`.
 */
const collectPublicIds = (issue) => new Set([
  issue.imagePublicId,
  ...(issue.images || []).map((img) => img.publicId),
  ...(issue.resolutionImages || []).map((img) => img.publicId)
].filter(Boolean));

/**
 * Thêm ảnh minh chứng sau xử lý. Đây là điều kiện để chuyển sang `resolved`,
 * nên phải là bước riêng trước khi đổi trạng thái.
 *
 * Nếu ghi DB thất bại thì xoá lại ảnh vừa upload để Cloudinary không tích rác
 * — cùng cách xử lý như createIssue.
 */
const addResolutionImages = async (issueId, files, user) => {
  if (!files?.length) {
    throw ApiError.badRequest('Chưa có ảnh nào được tải lên');
  }

  const uploaded = files.map((f) => ({ url: f.path, publicId: f.filename || null }));

  try {
    const issue = await Issue.findOne({ _id: issueId, isDeleted: false })
      .select('departmentId status resolutionImages mergedInto');
    if (!issue) throw ApiError.notFound('Issue not found.');
    if (issue.mergedInto) {
      throw ApiError.badRequest('Báo cáo này đã được gộp; hãy tải ảnh lên sự cố gốc');
    }

    assertCanHandleIssue(issue, user);

    if (issue.resolutionImages.length + uploaded.length > Issue.MAX_ISSUE_IMAGES) {
      throw ApiError.badRequest(
        `Chỉ được tối đa ${Issue.MAX_ISSUE_IMAGES} ảnh minh chứng (hiện có ${issue.resolutionImages.length}).`
      );
    }

    issue.resolutionImages.push(
      ...uploaded.map((img) => ({ ...img, uploadedBy: user.id, uploadedAt: new Date() }))
    );
    await issue.save();

    return issue.resolutionImages;
  } catch (error) {
    for (const img of uploaded) {
      await destroyIssueImage(img.publicId);
    }
    throw error;
  }
};

/**
 * Soft delete: đánh dấu isDeleted thay vì xoá hẳn để không làm sai lệch
 * số liệu thống kê lịch sử. Ảnh trên Cloudinary thì xoá thật vì không
 * còn được hiển thị ở đâu và tính vào quota lưu trữ.
 */
const deleteIssue = async (id, adminUser = null) => {
  const issue = await Issue.findOneAndUpdate(
    { _id: id, isDeleted: false },
    {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: adminUser?.id || null,
      imageUrl: null,
      imagePublicId: null,
      images: [],
      resolutionImages: []
    },
    { new: false }
  );

  if (!issue) {
    throw ApiError.notFound('Issue not found.');
  }

  for (const publicId of collectPublicIds(issue)) {
    await destroyIssueImage(publicId);
  }
  enqueuePriorityRecalculation(issue._id);
  return issue;
};

const getMyIssues = async ({ userId, status, page = 1, limit = 10 }) => {
  const filter = { userId, isDeleted: false, mergedInto: null };
  if (status) filter.status = status;

  const { pageNum, limitNum, skip } = parsePagination(
    { page, limit },
    { defaultLimit: 10, maxLimit: 50 }
  );

  const [issues, total] = await Promise.all([
    Issue.find(filter)
      .select(ISSUE_LIST_FIELDS)
      .populate('adminId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum),
    Issue.countDocuments(filter)
  ]);

  return {
    issues,
    pagination: {
      current: pageNum,
      pages: Math.ceil(total / limitNum),
      total,
      limit: limitNum
    }
  };
};

const getMyIssueSummary = async (userId) => {
  const [summary] = await Issue.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
        mergedInto: null,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        reported: { $sum: { $cond: [{ $eq: ['$status', 'reported'] }, 1, 0] } },
        processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ]);

  return summary || {
    total: 0,
    reported: 0,
    processing: 0,
    resolved: 0,
    rejected: 0,
  };
};
const deleteMyIssue = async (issueId, userId) => {
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false });
  if (!issue) throw ApiError.notFound('Issue not found.');

  if (issue.userId.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only delete your own issues.');
  }
  if (issue.status !== 'reported') {
    throw ApiError.badRequest('Only issues with status "reported" can be deleted.');
  }

  const publicIds = collectPublicIds(issue);
  issue.isDeleted = true;
  issue.deletedAt = new Date();
  issue.deletedBy = userId;
  issue.imageUrl = null;
  issue.imagePublicId = null;
  issue.images = [];
  issue.resolutionImages = [];
  await issue.save();

  for (const publicId of publicIds) {
    await destroyIssueImage(publicId);
  }
  enqueuePriorityRecalculation(issue._id);
  return issue;
};

const updateMyIssue = async (issueId, userId, { title, description }) => {
  const issue = await Issue.findOne({ _id: issueId, isDeleted: false });
  if (!issue) throw ApiError.notFound('Issue not found.');

  if (issue.userId.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only edit your own issues.');
  }
  if (issue.status !== 'reported') {
    throw ApiError.badRequest('Only issues with status "reported" can be edited.');
  }

  if (title) issue.title = title.trim();
  if (description) issue.description = description.trim();
  await issue.save();
  await issue.populate('userId', 'name email');

  await markIssueEmbeddingPending(issue._id);
  enqueueIssueEmbedding(issue._id);

  return issue;
};

/**
 * Tìm các sự cố đang mở (reported/processing) quanh một toạ độ.
 * Dùng $geoNear trên index 2dsphere của field `geo` — MongoDB tự tính
 * khoảng cách mặt cầu và trả về danh sách đã sắp xếp gần → xa, nên không
 * cần bounding box + Haversine tự viết ở tầng Node nữa.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radiusMeters - Bán kính tính bằng mét (mặc định 300)
 * @returns {Array} Tối đa 5 sự cố gần nhất, kèm field `distance` (mét)
 */
const getNearbyIssues = async (lat, lng, radiusMeters = 300) => {
  return Issue.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        key: 'geo',
        distanceField: 'distance',
        maxDistance: radiusMeters,
        spherical: true,
        query: {
          status: { $in: ['reported', 'processing'] },
          isDeleted: false,
          mergedInto: null
        }
      }
    },
    { $limit: 5 },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'reporter'
      }
    },
    { $unwind: { path: '$reporter', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        title: 1,
        category: 1,
        status: 1,
        location: 1,
        district: 1,
        latitude: 1,
        longitude: 1,
        voteCount: 1,
        imageUrl: 1,
        createdAt: 1,
        distance: { $round: ['$distance', 0] },
        userId: {
          _id: '$reporter._id',
          name: '$reporter.name'
        }
      }
    }
  ]);
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
  getNearbyIssues,
  addResolutionImages
};
