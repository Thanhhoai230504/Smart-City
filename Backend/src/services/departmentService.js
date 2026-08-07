const Department = require('../models/Department');
const User = require('../models/User');
const Issue = require('../models/Issue');
const ApiError = require('../utils/apiError');
const { getSlaHours } = require('../utils/slaConfig');

/**
 * Danh sách đơn vị. Người dân chỉ cần biết đơn vị nào phụ trách loại sự cố nào,
 * nên mặc định chỉ trả đơn vị đang hoạt động; admin xem được cả đơn vị đã tắt.
 */
const getDepartments = async ({ includeInactive = false, category = null } = {}) => {
  const filter = {};
  if (!includeInactive) filter.isActive = true;
  if (category) filter.categories = category;

  return Department.find(filter).sort('name').lean();
};

const getDepartmentById = async (id) => {
  const department = await Department.findById(id).lean();
  if (!department) throw ApiError.notFound('Đơn vị không tồn tại');
  return department;
};

const createDepartment = async (data) => {
  const existing = await Department.findOne({ code: data.code?.toUpperCase() });
  if (existing) throw ApiError.badRequest(`Mã đơn vị "${data.code}" đã tồn tại`);

  return Department.create({
    name: data.name,
    code: data.code,
    description: data.description,
    email: data.email,
    phone: data.phone,
    categories: data.categories,
    slaHours: data.slaHours ?? null,
  });
};

const updateDepartment = async (id, data) => {
  // Chỉ cho sửa các field nghiệp vụ; không nhận nguyên req.body để tránh
  // client ghi đè những field không mong muốn.
  const allowed = ['name', 'code', 'description', 'email', 'phone', 'categories', 'slaHours', 'isActive'];
  const updates = {};
  allowed.forEach((key) => {
    if (data[key] !== undefined) updates[key] = data[key];
  });

  if (updates.code) {
    const duplicate = await Department.findOne({
      code: updates.code.toUpperCase(),
      _id: { $ne: id },
    });
    if (duplicate) throw ApiError.badRequest(`Mã đơn vị "${updates.code}" đã tồn tại`);
  }

  const department = await Department.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });
  if (!department) throw ApiError.notFound('Đơn vị không tồn tại');
  return department;
};

/**
 * Không xoá cứng đơn vị: cán bộ và sự cố đang trỏ tới nó sẽ mất tham chiếu.
 * Chỉ vô hiệu hoá, và chặn nếu còn việc đang xử lý.
 */
const deactivateDepartment = async (id) => {
  const department = await Department.findById(id);
  if (!department) throw ApiError.notFound('Đơn vị không tồn tại');

  const openIssues = await Issue.countDocuments({
    departmentId: id,
    isDeleted: false,
    mergedInto: null,
    status: { $in: ['reported', 'processing'] },
  });
  if (openIssues > 0) {
    throw ApiError.badRequest(
      `Đơn vị còn ${openIssues} sự cố chưa xử lý xong. Hãy chuyển sang đơn vị khác trước khi vô hiệu hoá.`
    );
  }

  department.isActive = false;
  await department.save();
  return department;
};

/**
 * Cán bộ thuộc đơn vị — dùng cho trang quản lý và cho cron gửi email nhắc hạn.
 */
const getDepartmentStaff = async (departmentId) => {
  return User.find({ departmentId, role: 'staff', isActive: true })
    .select('name email createdAt')
    .sort('name')
    .lean();
};

/**
 * Gán / bỏ gán cán bộ vào đơn vị. Đổi role user -> staff và ngược lại.
 */
const assignStaffToDepartment = async (userId, departmentId) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Người dùng không tồn tại');
  if (user.role === 'admin') {
    throw ApiError.badRequest('Không thể gán admin vào đơn vị');
  }

  if (departmentId === null) {
    user.role = 'user';
    user.departmentId = null;
  } else {
    const department = await Department.findOne({ _id: departmentId, isActive: true });
    if (!department) throw ApiError.notFound('Đơn vị không tồn tại hoặc đã bị vô hiệu hoá');
    user.role = 'staff';
    user.departmentId = department._id;
  }

  await user.save();
  return user;
};

/**
 * Thống kê hiệu suất xử lý theo đơn vị: tổng việc, đang xử lý, đúng hạn,
 * quá hạn, thời gian xử lý trung bình. Đây là số liệu để chấm điểm đơn vị.
 */
const getDepartmentStats = async () => {
  const rows = await Issue.aggregate([
    { $match: { isDeleted: false, mergedInto: null, departmentId: { $ne: null } } },
    {
      $group: {
        _id: '$departmentId',
        total: { $sum: 1 },
        processing: {
          $sum: { $cond: [{ $in: ['$status', ['reported', 'processing']] }, 1, 0] },
        },
        resolved: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
        },
        // Quá hạn = còn mở và đã qua dueAt
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ['$status', ['reported', 'processing']] },
                  { $ne: ['$dueAt', null] },
                  { $lt: ['$dueAt', '$$NOW'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        // Đã xử lý xong trong hạn
        onTimeResolved: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'resolved'] },
                  { $ne: ['$dueAt', null] },
                  { $ne: ['$resolvedAt', null] },
                  { $lte: ['$resolvedAt', '$dueAt'] },
                ],
              },
              1,
              0,
            ],
          },
        },
        // Giờ xử lý trung bình, tính từ lúc phân công
        avgHours: {
          $avg: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'resolved'] },
                  { $ne: ['$assignedAt', null] },
                  { $ne: ['$resolvedAt', null] },
                ],
              },
              {
                $divide: [{ $subtract: ['$resolvedAt', '$assignedAt'] }, 1000 * 60 * 60],
              },
              null,
            ],
          },
        },
        avgRating: { $avg: '$rating.score' },
      },
    },
  ]);

  const staffRows = await User.aggregate([
    { $match: { role: 'staff', isActive: true, departmentId: { $ne: null } } },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]);

  const departments = await Department.find().sort('name').lean();
  const byId = new Map(rows.map((r) => [r._id.toString(), r]));
  const staffById = new Map(staffRows.map((r) => [r._id.toString(), r.count]));

  return departments.map((dept) => {
    const row = byId.get(dept._id.toString());
    const resolved = row?.resolved || 0;
    const onTime = row?.onTimeResolved || 0;

    return {
      departmentId: dept._id,
      name: dept.name,
      code: dept.code,
      isActive: dept.isActive,
      staffCount: staffById.get(dept._id.toString()) || 0,
      total: row?.total || 0,
      processing: row?.processing || 0,
      resolved,
      overdue: row?.overdue || 0,
      // Tỷ lệ đúng hạn trên số việc đã xử lý xong
      onTimeRate: resolved > 0 ? Math.round((onTime / resolved) * 100) : null,
      avgResolutionHours: row?.avgHours ? Math.round(row.avgHours * 10) / 10 : null,
      avgRating: row?.avgRating ? Math.round(row.avgRating * 10) / 10 : null,
    };
  });
};

/**
 * Gợi ý đơn vị phù hợp cho một loại sự cố — dùng khi admin phân công để
 * không phải tự nhớ đơn vị nào phụ trách gì.
 */
const suggestDepartment = async (category) => {
  const candidates = await Department.find({ categories: category, isActive: true })
    .select('name code slaHours')
    .lean();

  return candidates.map((dept) => ({
    ...dept,
    slaHoursEffective: getSlaHours(category, dept.slaHours),
  }));
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  getDepartmentStaff,
  assignStaffToDepartment,
  getDepartmentStats,
  suggestDepartment,
};
