/**
 * Tài khoản [TEST] trên DB thật để kiểm thử app mobile qua server production.
 *
 *   npm run test-accounts -- create    tạo/cập nhật 2 tài khoản test
 *   npm run test-accounts -- assign    giao phiếu [TEST] chưa phân công cho đơn vị của cán bộ test
 *   npm run test-accounts -- status    liệt kê tài khoản + phiếu test
 *   npm run test-accounts -- cleanup   xoá phiếu test (kèm ảnh Cloudinary), bình luận,
 *                                      thông báo, phiên và chính 2 tài khoản test
 *                                      (nhật ký kiểm toán giữ nguyên — không xoá dấu vết)
 *
 * Mật khẩu đọc từ APP_TEST_ACCOUNT_PASSWORD trong Backend/.env (đã gitignore) —
 * KHÔNG ghi vào code: repo công khai, và tài khoản cán bộ đổi được trạng thái phiếu.
 *
 * Rào chắn: chỉ đụng tới đúng 2 email cố định bên dưới, và chỉ phiếu do tài khoản
 * người dân test tạo có tiêu đề bắt đầu bằng "[TEST]". Cán bộ test thuộc đơn vị
 * UBND (đơn vị chưa có cán bộ thật) để phiếu thử không lẫn vào việc của ai.
 * Email dùng miền example.com (RFC 2606) nên thư hệ thống gửi tới không tới ai.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { configureDnsServers } = require('../config/dns');

const TEST_CITIZEN = { email: 'test.nguoidan@example.com', name: '[TEST] Người dân' };
const TEST_STAFF = { email: 'test.canbo@example.com', name: '[TEST] Cán bộ', departmentCode: 'UBND' };
const TEST_EMAILS = [TEST_CITIZEN.email, TEST_STAFF.email];
const TITLE_PREFIX = /^\[TEST\]/;
const MIN_PASSWORD_LENGTH = 12;

const isTestTitle = (title) => typeof title === 'string' && TITLE_PREFIX.test(title.trim());

const readPassword = (env = process.env) => {
  const password = env.APP_TEST_ACCOUNT_PASSWORD;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Thiếu APP_TEST_ACCOUNT_PASSWORD (≥ ${MIN_PASSWORD_LENGTH} ký tự) trong Backend/.env`);
  }
  return password;
};

const models = () => ({
  User: require('../models/User'),
  Department: require('../models/Department'),
  Issue: require('../models/Issue'),
  Comment: require('../models/Comment'),
  Notification: require('../models/Notification'),
  RefreshSession: require('../models/RefreshSession'),
});

const upsertUser = async (User, { email, name, role, departmentId }, password) => {
  let user = await User.findOne({ email }).select('+password');
  if (!user) user = new User({ email });
  Object.assign(user, {
    name,
    role,
    departmentId: departmentId || null,
    provider: 'local',
    isActive: true,
    isVerified: true,
    password, // hook pre-save băm lại
  });
  await user.save();
  return user;
};

const create = async () => {
  const { User, Department } = models();
  const password = readPassword();
  const dept = await Department.findOne({ code: TEST_STAFF.departmentCode, isActive: true });
  if (!dept) throw new Error(`Không tìm thấy đơn vị ${TEST_STAFF.departmentCode} đang hoạt động`);

  await upsertUser(User, { ...TEST_CITIZEN, role: 'user' }, password);
  await upsertUser(User, { ...TEST_STAFF, role: 'staff', departmentId: dept._id }, password);
  console.log(`✅ ${TEST_CITIZEN.email} (người dân)`);
  console.log(`✅ ${TEST_STAFF.email} (cán bộ ${dept.code} — ${dept.name})`);
  console.log('   Mật khẩu: giá trị APP_TEST_ACCOUNT_PASSWORD trong Backend/.env');
};

const testIssues = async (Issue, User) => {
  const citizen = await User.findOne({ email: TEST_CITIZEN.email }).select('_id');
  if (!citizen) return [];
  const issues = await Issue.find({ userId: citizen._id, isDeleted: false });
  return issues.filter((i) => isTestTitle(i.title));
};

const assign = async () => {
  const { User, Department, Issue } = models();
  const { calculateDueAt } = require('../utils/slaConfig');
  const dept = await Department.findOne({ code: TEST_STAFF.departmentCode });
  const now = new Date();
  let assigned = 0;
  for (const issue of await testIssues(Issue, User)) {
    if (issue.departmentId) continue;
    // Ghi thẳng thay vì qua assignmentService: service đó gửi email/thông báo
    // phân công — không cần cho phiếu thử.
    await Issue.updateOne(
      { _id: issue._id, departmentId: null },
      {
        $set: {
          departmentId: dept._id,
          assignedAt: now,
          dueAt: calculateDueAt(issue.category, dept.slaHours, now),
          escalationLevel: 0,
        },
      }
    );
    assigned += 1;
    console.log(`📌 Giao "${issue.title}" cho ${dept.code}`);
  }
  console.log(`Xong — ${assigned} phiếu được giao.`);
};

const status = async () => {
  const { User, Issue } = models();
  const users = await User.find({ email: { $in: TEST_EMAILS } }).select('email role departmentId isActive');
  console.log('Tài khoản:', users.map((u) => `${u.email} (${u.role})`).join(', ') || 'chưa có');
  for (const i of await testIssues(Issue, User)) {
    console.log(`- ${i._id} ${i.status.padEnd(10)} ${i.departmentId ? 'đã giao ' : 'chưa giao'}  ${i.title}`);
  }
};

const cleanup = async () => {
  const { User, Issue, Comment, Notification, RefreshSession } = models();
  const { deleteIssue } = require('../services/issueService');
  const users = await User.find({ email: { $in: TEST_EMAILS } }).select('_id email');
  const userIds = users.map((u) => u._id);
  const issues = await testIssues(Issue, User);

  for (const issue of issues) {
    // Soft delete + xoá ảnh thật trên Cloudinary (kể cả ảnh minh chứng).
    await deleteIssue(issue._id, null);
    console.log(`🗑️  ${issue.title}`);
  }
  const issueIds = issues.map((i) => i._id);
  const comments = await Comment.deleteMany({ $or: [{ userId: { $in: userIds } }, { issueId: { $in: issueIds } }] });
  // Gồm cả thông báo gửi cho admin thật về phiếu [TEST].
  const notifications = await Notification.deleteMany({
    $or: [{ userId: { $in: userIds } }, { issueId: { $in: issueIds } }],
  });
  const sessions = await RefreshSession.deleteMany({ userId: { $in: userIds } });
  const removedUsers = await User.deleteMany({ _id: { $in: userIds }, email: { $in: TEST_EMAILS } });
  console.log(
    `Xong — ${issues.length} phiếu, ${comments.deletedCount} bình luận, ${notifications.deletedCount} thông báo, `
    + `${sessions.deletedCount} phiên, ${removedUsers.deletedCount} tài khoản.`
  );
};

const COMMANDS = { create, assign, status, cleanup };

const run = async (command) => {
  const fn = COMMANDS[command];
  if (!fn) throw new Error(`Lệnh không hợp lệ "${command}". Dùng: ${Object.keys(COMMANDS).join(' | ')}`);
  if (command === 'create') readPassword(); // hỏng sớm, trước khi kết nối DB
  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await fn();
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  run(process.argv[2]).then(() => process.exit(0)).catch(async (err) => {
    console.error('❌', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run, isTestTitle, readPassword, TEST_EMAILS };
