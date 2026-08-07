const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  // user: người dân báo cáo sự cố
  // staff: cán bộ thuộc một đơn vị, chỉ xử lý sự cố được phân công cho đơn vị đó
  // admin: quản trị toàn hệ thống, phân công và leo cấp
  role: {
    type: String,
    enum: ['user', 'staff', 'admin'],
    default: 'user'
  },
  // Đơn vị của cán bộ. Bắt buộc với role 'staff', null với các role khác.
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  providerId: {
    type: String,
    default: null
  },
  avatar: {
    type: String,
    default: null
  },
  refreshToken: {
    type: String,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Mặc định true để tài khoản đã tồn tại trước khi triển khai B4 không bị khóa.
  // Luồng đăng ký local mới luôn ghi rõ false cho tới khi người dùng bấm link email.
  isVerified: {
    type: Boolean,
    default: true
  },
  emailVerificationTokenHash: {
    type: String,
    default: null,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    default: null,
    select: false
  },
  emailVerificationSentAt: {
    type: Date,
    default: null,
    select: false
  },
  watchedDistricts: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Hash password before saving (only for local accounts)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Validate password is required for local accounts
userSchema.pre('validate', function(next) {
  if (this.provider === 'local' && this.isNew && !this.password) {
    this.invalidate('password', 'Password is required for local accounts');
  }
  // Cán bộ không thuộc đơn vị nào thì không phân quyền được — chặn ngay ở model
  // để không tạo được tài khoản staff "mồ côi" qua bất kỳ đường ghi nào.
  if (this.role === 'staff' && !this.departmentId) {
    this.invalidate('departmentId', 'Cán bộ (staff) phải thuộc một đơn vị');
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.refreshToken;
  delete user.emailVerificationTokenHash;
  delete user.emailVerificationExpires;
  delete user.emailVerificationSentAt;
  delete user.__v;
  return user;
};

// Lấy danh sách cán bộ của một đơn vị (gửi email nhắc hạn, phân công cho cán bộ)
userSchema.index({ departmentId: 1, role: 1 });
// Danh sách quản trị phân trang/lọc và truy vấn người theo dõi khu vực.
userSchema.index({ role: 1, isActive: 1, createdAt: -1 });
userSchema.index({ watchedDistricts: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
