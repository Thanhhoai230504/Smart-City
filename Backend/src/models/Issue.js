const mongoose = require('mongoose');
const { DISTRICT_ENUM, UNKNOWN_DISTRICT, resolveDistrict } = require('../utils/districts');
const { getSlaStatus } = require('../utils/slaConfig');

/** Số ảnh tối đa cho một sự cố */
const MAX_ISSUE_IMAGES = 5;

const issueSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['pothole', 'garbage', 'streetlight', 'flooding', 'tree', 'other'],
      message: 'Category must be one of: pothole, garbage, streetlight, flooding, tree, other'
    }
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: [-90, 'Latitude must be between -90 and 90'],
    max: [90, 'Latitude must be between -90 and 90']
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: [-180, 'Longitude must be between -180 and 180'],
    max: [180, 'Longitude must be between -180 and 180']
  },
  // Quận/huyện chuẩn hoá từ `location` khi lưu. Có index nên truy vấn và
  // aggregate theo khu vực không cần $regex quét toàn bảng.
  district: {
    type: String,
    enum: [...DISTRICT_ENUM, UNKNOWN_DISTRICT],
    default: UNKNOWN_DISTRICT
  },
  // GeoJSON Point [longitude, latitude] — dùng cho truy vấn $nearSphere.
  // Được đồng bộ tự động từ latitude/longitude qua hook pre-save/pre-update.
  geo: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: undefined
    }
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  // Ảnh đầu tiên. Giữ lại để tương thích với dữ liệu và UI cũ; luôn trùng
  // với phần tử đầu của `images`.
  imageUrl: {
    type: String,
    default: null
  },
  // public_id của ảnh trên Cloudinary, cần để xoá ảnh khi xoá sự cố.
  imagePublicId: {
    type: String,
    default: null
  },
  // Nhiều ảnh cho một sự cố (tối đa MAX_ISSUE_IMAGES).
  images: {
    type: [{
      url: { type: String, required: true },
      publicId: { type: String, default: null },
      _id: false
    }],
    validate: {
      validator: (arr) => !arr || arr.length <= MAX_ISSUE_IMAGES,
      message: `Mỗi sự cố chỉ được tối đa ${MAX_ISSUE_IMAGES} ảnh`
    }
  },
  // Ảnh minh chứng đơn vị chụp sau khi xử lý xong. Bắt buộc khi chuyển
  // sang `resolved` — làm cho điểm đánh giá của người dân có căn cứ.
  resolutionImages: {
    type: [{
      url: { type: String, required: true },
      publicId: { type: String, default: null },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      uploadedAt: { type: Date, default: Date.now },
      _id: false
    }],
    validate: {
      validator: (arr) => !arr || arr.length <= MAX_ISSUE_IMAGES,
      message: `Mỗi sự cố chỉ được tối đa ${MAX_ISSUE_IMAGES} ảnh minh chứng`
    }
  },
  status: {
    type: String,
    enum: {
      values: ['reported', 'processing', 'resolved', 'rejected'],
      message: 'Status must be one of: reported, processing, resolved, rejected'
    },
    default: 'reported'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  votes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Người cần tiếp tục nhận cập nhật về sự cố. Reporter được thêm khi tạo;
  // người xác nhận báo cáo trùng và reporter của bản ghi được gộp cũng được giữ lại.
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  voteCount: {
    type: Number,
    default: 0
  },
  statusHistory: [{
    status: { type: String, enum: ['reported', 'processing', 'resolved', 'rejected'] },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }],
  rating: {
    score: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, trim: true, maxlength: 500, default: null },
    ratedAt: { type: Date, default: null }
  },
  // ─── Phân công xử lý ───
  // Đơn vị được phân công. null = chưa phân công.
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  // Cán bộ (role 'staff') trực tiếp nhận việc trong đơn vị.
  assigneeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },

  // ─── SLA ───
  // Hạn xử lý, tính từ lúc phân công theo slaConfig. null = chưa phân công.
  dueAt: {
    type: Date,
    default: null
  },
  // 0 = chưa nhắc, 1 = đã nhắc đơn vị, 2 = đã leo cấp lên admin.
  // Cron dùng field này để không gửi trùng thông báo mỗi lần chạy.
  escalationLevel: {
    type: Number,
    enum: [0, 1, 2],
    default: 0
  },
  lastReminderAt: {
    type: Date,
    default: null
  },

  // ─── Gộp sự cố trùng lặp ───
  // Trỏ về sự cố gốc nếu bản ghi này là báo cáo trùng đã được gộp.
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Issue',
    default: null
  },
  mergedAt: {
    type: Date,
    default: null
  },
  mergedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Số báo cáo trùng đã gộp vào bản ghi này — thể hiện mức độ nghiêm trọng.
  duplicateCount: {
    type: Number,
    default: 0
  },

  // ─── Xếp hạng ưu tiên tự động ───
  // Chỉ là điểm hỗ trợ sắp xếp; không tự quyết định phân công/trạng thái.
  priorityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null
  },
  priorityLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical', null],
    default: null
  },
  priorityFactors: {
    type: [{
      code: {
        type: String,
        enum: ['severity', 'age_sla', 'votes', 'nearby_density', 'sensitive_place'],
        required: true
      },
      rawValue: { type: mongoose.Schema.Types.Mixed, default: null },
      normalizedScore: { type: Number, min: 0, max: 100, required: true },
      weight: { type: Number, min: 0, max: 1, required: true },
      points: { type: Number, min: 0, max: 100, required: true },
      message: { type: String, required: true },
      _id: false
    }],
    default: []
  },
  priorityVersion: {
    type: String,
    default: null
  },
  priorityCalculatedAt: {
    type: Date,
    default: null
  },

  // ─── Embedding phát hiện trùng ───
  // Vector không bao giờ được select mặc định hoặc trả ra API. Metadata được giữ
  // để job resume, cache theo sourceHash và truy vết model/version.
  embedding: {
    vector: {
      type: [Number],
      select: false,
      default: undefined
    },
    model: { type: String, default: null },
    version: { type: String, default: null },
    dimensions: { type: Number, default: null },
    sourceHash: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed'],
      default: 'pending'
    },
    generatedAt: { type: Date, default: null },
    processingStartedAt: { type: Date, default: null },
    attempts: { type: Number, min: 0, default: 0 },
    lastError: { type: String, default: null, maxlength: 500 },
  },

  // Soft delete: giữ bản ghi để không làm sai lệch dữ liệu thống kê lịch sử.
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  // Bật virtuals khi serialize để `slaStatus` đi kèm response API.
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Tự động đồng bộ district + geo từ latitude/longitude/location.
// Đặt ở model để mọi đường ghi (create, save, seed) đều có dữ liệu chuẩn hoá.
issueSchema.pre('validate', function(next) {
  if (this.isModified('latitude') || this.isModified('longitude') || this.isNew) {
    if (typeof this.latitude === 'number' && typeof this.longitude === 'number') {
      this.geo = { type: 'Point', coordinates: [this.longitude, this.latitude] };
    }
  }
  if (this.isModified('location') || this.isNew) {
    this.district = resolveDistrict(this.location);
  }

  // Giữ imageUrl/imagePublicId luôn trùng phần tử đầu của `images` để code
  // và dữ liệu cũ (chỉ biết 1 ảnh) vẫn hoạt động đúng.
  if (this.isModified('images')) {
    const first = this.images?.[0];
    this.imageUrl = first?.url || null;
    this.imagePublicId = first?.publicId || null;
  }

  next();
});

/**
 * Trạng thái SLA tính tại thời điểm đọc, không lưu trong DB vì phụ thuộc
 * thời gian hiện tại. Cần `.toJSON({ virtuals: true })` (đã bật ở options).
 */
issueSchema.virtual('slaStatus').get(function() {
  return getSlaStatus(this);
});

// Indexes bám theo đúng prefix filter của các màn hình danh sách. Compound
// index giúp MongoDB vừa lọc soft-delete/merged vừa sort mà không quét toàn bộ.
issueSchema.index({ isDeleted: 1, mergedInto: 1, createdAt: -1 });
issueSchema.index({ isDeleted: 1, mergedInto: 1, status: 1, createdAt: -1 });
issueSchema.index({ isDeleted: 1, mergedInto: 1, category: 1, createdAt: -1 });
issueSchema.index({ district: 1, isDeleted: 1, mergedInto: 1, status: 1, createdAt: -1 });
issueSchema.index({ userId: 1, isDeleted: 1, mergedInto: 1, createdAt: -1 });
issueSchema.index(
  { title: 'text', description: 'text' },
  { default_language: 'none', weights: { title: 5, description: 1 } }
);
issueSchema.index({ geo: '2dsphere' });
// Đơn vị/cán bộ xem danh sách việc của mình
issueSchema.index({ departmentId: 1, isDeleted: 1, mergedInto: 1, status: 1, dueAt: 1 });
issueSchema.index({ assigneeId: 1, isDeleted: 1, mergedInto: 1, status: 1, createdAt: -1 });
// Hàng chờ admin ưu tiên phiếu nhiều lượt ủng hộ rồi tới phiếu cũ.
issueSchema.index({ departmentId: 1, isDeleted: 1, mergedInto: 1, status: 1, voteCount: -1, createdAt: 1 });
issueSchema.index({ departmentId: 1, isDeleted: 1, mergedInto: 1, status: 1, priorityScore: -1, createdAt: 1 });
issueSchema.index({ isDeleted: 1, mergedInto: 1, status: 1, priorityCalculatedAt: 1 });
issueSchema.index({ 'embedding.status': 1, 'embedding.generatedAt': 1, isDeleted: 1, mergedInto: 1 });
// Cron quét sự cố quá hạn: lọc theo dueAt + escalationLevel
issueSchema.index({ dueAt: 1, escalationLevel: 1, status: 1 });

const Issue = mongoose.model('Issue', issueSchema);

// Export kèm hằng số để route upload dùng chung một giới hạn với validator,
// không phải khai lại con số 5 ở hai chỗ.
module.exports = Issue;
module.exports.MAX_ISSUE_IMAGES = MAX_ISSUE_IMAGES;
