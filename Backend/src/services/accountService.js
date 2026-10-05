const crypto = require('crypto');
const User = require('../models/User');
const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/apiError');
const sessionService = require('./sessionService');

/** Tên hiển thị thay cho tên thật sau khi xoá tài khoản. */
const ANONYMIZED_NAME = 'Người dùng đã xoá';

/**
 * Email thay thế: vẫn phải duy nhất (model có unique index) và không được dùng
 * lại để đăng nhập. Hash của email cũ cho ra giá trị ổn định, không khôi phục
 * ngược được, nhưng vẫn phân biệt được hai tài khoản đã xoá khác nhau.
 */
const anonymizedEmail = (email) => {
  const digest = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24);
  return `deleted-${digest}@deleted.invalid`;
};

/**
 * Xoá tài khoản theo yêu cầu của chính người dùng.
 *
 * Vì sao cần: `routes/users.js` chỉ có 3 endpoint và đều dành cho admin, không có
 * `DELETE` nào. Cơ chế "đóng" duy nhất là `toggleUserActive` — chỉ đảo `isActive`
 * và GIỮ NGUYÊN email, tên, số điện thoại.
 *
 * Ngoài khía cạnh quyền riêng tư, đây còn là điều kiện bắt buộc để lên store:
 * app có màn tạo tài khoản thì BẮT BUỘC có xoá tài khoản ngay trong app
 * (chính sách Google Play từ 2023, App Store tương tự). Thiếu là bị từ chối duyệt.
 *
 * Cách làm là ẨN DANH HOÁ chứ không xoá cứng — xoá cứng người dùng sẽ kéo theo
 * phiếu, bình luận và lịch sử xử lý, làm sai lệch mọi thống kê đã công bố và phá
 * các tham chiếu `changedBy`/`assignedBy`. Đây đúng tinh thần soft delete mà
 * `Issue` đang dùng.
 *
 * PII nằm ở BA nơi, không chỉ bảng User:
 *   1. User: name, email, avatar, providerId
 *   2. Issue.phone — số điện thoại người báo cáo nhập khi gửi phiếu
 *   3. AuditLog: ipAddress, userAgent
 */
const deleteAccount = async (userId, { password }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng.');

  // Tài khoản local phải xác nhận bằng mật khẩu: xoá tài khoản là hành động
  // không hoàn tác được, và access token có thể đã bị đánh cắp.
  if (user.provider === 'local') {
    if (!password) {
      throw ApiError.badRequestWithCode(
        'Vui lòng nhập mật khẩu để xác nhận xoá tài khoản',
        'PASSWORD_REQUIRED'
      );
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.badRequestWithCode('Mật khẩu không đúng', 'INVALID_PASSWORD');
    }
  }

  // Admin cuối cùng mà tự xoá thì không còn ai quản trị được hệ thống, và chỉ
  // sửa trực tiếp trong database mới khôi phục được.
  if (user.role === 'admin') {
    const remainingAdmins = await User.countDocuments({
      role: 'admin',
      isActive: true,
      _id: { $ne: user._id },
    });
    if (remainingAdmins === 0) {
      throw ApiError.badRequestWithCode(
        'Không thể xoá quản trị viên cuối cùng. Hãy chỉ định quản trị viên khác trước.',
        'LAST_ADMIN'
      );
    }
  }

  const originalEmail = user.email;

  // 1. Ẩn danh hoá tài khoản
  user.name = ANONYMIZED_NAME;
  user.email = anonymizedEmail(originalEmail);
  user.avatar = null;
  user.providerId = null;
  user.isActive = false;
  user.watchedDistricts = [];
  // Mật khẩu ngẫu nhiên không ai biết: an toàn hơn để null vì không còn đường
  // đăng nhập nào, kể cả khi có lỗi logic ở chỗ khác.
  user.password = crypto.randomBytes(32).toString('hex');
  user.refreshToken = null;
  user.passwordResetTokenHash = null;
  user.emailVerificationTokenHash = null;
  await user.save();

  // 2. Gỡ số điện thoại khỏi mọi phiếu người này đã gửi. Giữ nguyên phiếu để
  //    thống kê và lịch sử xử lý không bị lệch.
  const issueResult = await Issue.updateMany(
    { userId: user._id, phone: { $ne: null } },
    { $set: { phone: null } }
  );

  // 3. Gỡ dấu vết kỹ thuật trong nhật ký quản trị. Giữ `actorId` để chuỗi trách
  //    nhiệm còn đọc được — nó giờ trỏ tới một tài khoản đã ẩn danh.
  const auditResult = await AuditLog.updateMany(
    { actorId: user._id },
    { $set: { ipAddress: null, userAgent: null } }
  );

  // 4. Thông báo là dữ liệu riêng tư và không còn giá trị với ai → xoá hẳn.
  const notificationResult = await Notification.deleteMany({ userId: user._id });

  // 5. Cắt mọi phiên đăng nhập.
  await sessionService.revokeAllSessions(user._id);

  return {
    anonymizedIssues: issueResult.modifiedCount || 0,
    anonymizedAuditLogs: auditResult.modifiedCount || 0,
    deletedNotifications: notificationResult.deletedCount || 0,
  };
};

module.exports = { deleteAccount, anonymizedEmail, ANONYMIZED_NAME };
