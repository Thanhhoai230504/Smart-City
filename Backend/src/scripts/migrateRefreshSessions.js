/**
 * Chuyển `User.refreshToken` (một field, một phiên) sang collection RefreshSession.
 *
 * Chạy MỘT LẦN khi deploy B1. Không chạy thì người đang đăng nhập trên web sẽ bị
 * đăng xuất ở lần refresh kế tiếp — không mất dữ liệu, nhưng là trải nghiệm tệ
 * không cần thiết.
 *
 *   node src/scripts/migrateRefreshSessions.js
 *   node src/scripts/migrateRefreshSessions.js --drop-field
 *
 * Mặc định GIỮ field `refreshToken` cũ để rollback được. Chỉ thêm `--drop-field`
 * sau khi đã chạy ổn định một thời gian.
 *
 * Idempotent: chạy lại nhiều lần không tạo phiên trùng (tokenHash là unique và
 * script bỏ qua token đã có phiên).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const RefreshSession = require('../models/RefreshSession');
const { REFRESH_TTL_MS } = require('../services/sessionService');

const dropField = process.argv.includes('--drop-field');

const run = async () => {
  await connectDB();

  const users = await User.find({
    refreshToken: { $ne: null, $exists: true },
  }).select('+refreshToken _id');

  console.log(`Tìm thấy ${users.length} tài khoản còn refreshToken kiểu cũ.`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const tokenHash = RefreshSession.hashToken(user.refreshToken);
    const existing = await RefreshSession.findOne({ tokenHash });
    if (existing) {
      skipped += 1;
      continue;
    }

    // Không biết token cũ được cấp lúc nào, nên lấy mốc an toàn: hết hạn sau
    // đúng TTL kể từ bây giờ. Tệ nhất là người dùng được gia hạn thêm vài ngày,
    // tốt hơn là đá hàng loạt người đang đăng nhập ra.
    await RefreshSession.create({
      userId: user._id,
      tokenHash,
      deviceType: 'web',
      deviceName: 'Phiên web (trước khi tách phiên)',
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      lastUsedAt: new Date(),
    });
    created += 1;
  }

  console.log(`Đã tạo ${created} phiên, bỏ qua ${skipped} phiên đã có.`);

  if (dropField) {
    const result = await User.updateMany(
      { refreshToken: { $exists: true } },
      { $unset: { refreshToken: '' } }
    );
    console.log(`Đã gỡ field refreshToken khỏi ${result.modifiedCount} tài khoản.`);
  } else {
    console.log('Giữ nguyên field refreshToken cũ. Thêm --drop-field để gỡ sau khi chạy ổn định.');
  }

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('Migration thất bại:', err.message);
  process.exit(1);
});
