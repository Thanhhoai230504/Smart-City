/**
 * Seed danh sách đơn vị xử lý sự cố.
 *
 * Đây chính là danh sách trước kia bị hardcode ở frontend
 * (IssueDetail/index.tsx) chỉ để hiển thị. Giờ đưa vào DB để phân công và
 * tính SLA thật.
 *
 * Chạy:  node src/seeds/seedDepartments.js
 *
 * Idempotent: upsert theo `code`, không xoá dữ liệu nào — chạy lại nhiều lần
 * vẫn an toàn, và không ghi đè `slaHours` admin đã chỉnh trên UI.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Department = require('../models/Department');
const { configureDnsServers } = require('../config/dns');

const DEPARTMENTS = [
  {
    code: 'HTGT',
    name: 'Phòng Quản lý Hạ tầng Giao thông',
    description: 'Quản lý, duy tu mặt đường và hạ tầng giao thông đô thị',
    email: 'hatang.gt@danang.gov.vn',
    phone: '0236 3821 234',
    categories: ['pothole'],
  },
  {
    code: 'MTDT',
    name: 'Công ty Môi trường Đô thị Đà Nẵng',
    description: 'Thu gom, vận chuyển và xử lý rác thải đô thị',
    email: 'moitruong@danang.gov.vn',
    phone: '0236 3847 777',
    categories: ['garbage'],
  },
  {
    code: 'CSTH',
    name: 'Công ty Chiếu sáng & Tín hiệu Đà Nẵng',
    description: 'Vận hành hệ thống đèn đường và đèn tín hiệu giao thông',
    email: 'chieusang@danang.gov.vn',
    phone: '0236 3891 555',
    categories: ['streetlight'],
  },
  {
    code: 'TN',
    name: 'Phòng Quản lý Thoát nước',
    description: 'Quản lý hệ thống thoát nước, chống ngập úng',
    email: 'thoatnuoc@danang.gov.vn',
    phone: '0236 3822 333',
    categories: ['flooding'],
  },
  {
    code: 'CX',
    name: 'Công ty Cây xanh Đà Nẵng',
    description: 'Chăm sóc, cắt tỉa và xử lý cây xanh đô thị',
    email: 'cayxanh@danang.gov.vn',
    phone: '0236 3836 666',
    categories: ['tree'],
  },
  {
    code: 'UBND',
    name: 'UBND Thành phố Đà Nẵng',
    description: 'Tiếp nhận các phản ánh không thuộc chuyên môn đơn vị nào',
    email: 'ubnd@danang.gov.vn',
    phone: '0236 3822 111',
    categories: ['other'],
  },
];

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Thiếu MONGODB_URI trong .env');
    process.exit(1);
  }

  configureDnsServers();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Đã kết nối MongoDB');

  for (const dept of DEPARTMENTS) {
    // $setOnInsert cho slaHours: chỉ set khi tạo mới, để không ghi đè giá trị
    // admin đã tinh chỉnh trên UI khi seed lại.
    const result = await Department.updateOne(
      { code: dept.code },
      { $set: dept, $setOnInsert: { slaHours: null, isActive: true } },
      { upsert: true, runValidators: true }
    );
    const action = result.upsertedCount ? 'tạo mới' : 'cập nhật';
    console.log(`   ${action}: ${dept.code} — ${dept.name}`);
  }

  console.log(`🏁 Xong ${DEPARTMENTS.length} đơn vị`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch(async (err) => {
    console.error('❌ Seed đơn vị thất bại:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { run, DEPARTMENTS };
