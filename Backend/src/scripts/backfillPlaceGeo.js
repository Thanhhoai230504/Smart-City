/**
 * Điền Place.geo cho dữ liệu địa điểm cũ. Chạy lại an toàn, không xoá dữ liệu.
 *   npm run backfill:places
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('../models/Place');
const { configureDnsServers } = require('../config/dns');

const BATCH_SIZE = 500;

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Thiếu MONGODB_URI trong .env');
  }

  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB');

  const cursor = Place.find({
    $or: [
      { geo: { $exists: false } },
      { 'geo.coordinates': { $exists: false } },
    ],
  }).select('_id latitude longitude').lean().cursor();

  let operations = [];
  let updated = 0;
  let skipped = 0;

  const flush = async () => {
    if (!operations.length) return;
    await Place.bulkWrite(operations, { ordered: false });
    updated += operations.length;
    operations = [];
  };

  for await (const place of cursor) {
    if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
      skipped += 1;
      continue;
    }
    operations.push({
      updateOne: {
        filter: { _id: place._id },
        update: {
          $set: {
            geo: { type: 'Point', coordinates: [place.longitude, place.latitude] },
          },
        },
      },
    });
    if (operations.length >= BATCH_SIZE) await flush();
  }
  await flush();

  // createIndexes chỉ thêm index khai báo còn thiếu, không drop index ngoài schema.
  await Place.createIndexes();
  console.log(`📍 Đã cập nhật geo cho ${updated} địa điểm; bỏ qua ${skipped} bản ghi thiếu toạ độ`);
  await mongoose.disconnect();
  return { updated, skipped };
};

if (require.main === module) {
  run().catch(async (error) => {
    console.error('❌ Backfill Place.geo thất bại:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run };
