const mongoose = require('mongoose');
const { ISSUE_CATEGORIES } = require('../utils/slaConfig');

/**
 * Đơn vị xử lý sự cố (sở/ngành/công ty công ích).
 * Trước đây danh sách này bị hardcode ở frontend chỉ để hiển thị, không gắn
 * với dữ liệu — giờ là bảng thật để phân công và tính SLA.
 */
const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên đơn vị là bắt buộc'],
    trim: true,
    maxlength: [150, 'Tên đơn vị không quá 150 ký tự']
  },
  // Mã ngắn để tra cứu và hiển thị, ví dụ 'HTGT', 'MTDT'
  code: {
    type: String,
    required: [true, 'Mã đơn vị là bắt buộc'],
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: [20, 'Mã đơn vị không quá 20 ký tự']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không quá 500 ký tự'],
    default: ''
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/, 'Email không hợp lệ'],
    default: null
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  // Các loại sự cố đơn vị này phụ trách — dùng để gợi ý phân công tự động
  categories: {
    type: [String],
    enum: {
      values: ISSUE_CATEGORIES,
      message: 'Loại sự cố không hợp lệ'
    },
    default: []
  },
  // Ghi đè số giờ SLA mặc định theo loại sự cố. null = dùng cấu hình chung.
  slaHours: {
    type: Number,
    min: [1, 'SLA tối thiểu 1 giờ'],
    max: [720, 'SLA tối đa 720 giờ (30 ngày)'],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

departmentSchema.index({ categories: 1, isActive: 1 });

module.exports = mongoose.model('Department', departmentSchema);
