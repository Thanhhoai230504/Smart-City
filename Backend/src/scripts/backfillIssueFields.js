/**
 * Backfill cho các sự cố tạo trước khi thêm 3 field mới:
 *   - district: suy ra từ chuỗi `location` (giờ lưu sẵn, có index)
 *   - geo:      GeoJSON Point từ latitude/longitude, cho $geoNear
 *   - isDeleted: false cho bản ghi cũ chưa có field soft delete
 *
 * Chạy MỘT LẦN sau khi deploy:  node src/scripts/backfillIssueFields.js
 *
 * Script chỉ ghi các field trên, không xoá hay đổi dữ liệu nào khác, nên
 * chạy lại nhiều lần vẫn an toàn (idempotent).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const { resolveDistrict } = require('../utils/districts');
const { configureDnsServers } = require('../config/dns');

const BATCH_SIZE = 500;

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Thiếu MONGODB_URI trong .env');
    process.exit(1);
  }

  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB');

  // 1. isDeleted cho bản ghi cũ
  const deletedRes = await Issue.updateMany(
    { isDeleted: { $exists: false } },
    { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }
  );
  console.log(`📝 isDeleted: cập nhật ${deletedRes.modifiedCount} bản ghi`);

  // 2. district + geo — phải đọc từng doc vì giá trị phụ thuộc nội dung
  const cursor = Issue.find({
    $or: [
      { district: { $exists: false } },
      { district: null },
      { 'geo.coordinates': { $exists: false } },
    ],
  })
    .select('_id location latitude longitude district geo')
    .lean()
    .cursor();

  let ops = [];
  let updated = 0;
  let noCoords = 0;

  const flush = async () => {
    if (!ops.length) return;
    await Issue.bulkWrite(ops, { ordered: false });
    updated += ops.length;
    console.log(`   ... đã ghi ${updated} bản ghi`);
    ops = [];
  };

  for await (const doc of cursor) {
    const set = { district: resolveDistrict(doc.location) };

    if (typeof doc.latitude === 'number' && typeof doc.longitude === 'number') {
      set.geo = { type: 'Point', coordinates: [doc.longitude, doc.latitude] };
    } else {
      noCoords += 1;
    }

    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    if (ops.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`📍 district/geo: cập nhật ${updated} bản ghi`);
  if (noCoords > 0) {
    console.warn(`⚠️  ${noCoords} bản ghi thiếu toạ độ, không tạo được geo — sẽ không xuất hiện trong truy vấn "sự cố gần đây".`);
  }

  // 3. Đảm bảo index mới đã được tạo (2dsphere, district, isDeleted)
  await Issue.syncIndexes();
  console.log('🔎 Đã đồng bộ index');

  await mongoose.disconnect();
  console.log('🏁 Xong');
};

// Chỉ chạy khi được gọi trực tiếp bằng `node src/scripts/backfillIssueFields.js`.
// Nếu để chạy ở top-level thì chỉ cần require file này (test, tooling) là đã
// ghi thật vào database.
if (require.main === module) {
  run().catch(async (err) => {
    console.error('❌ Backfill thất bại:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run };
