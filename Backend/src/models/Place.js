const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vui lòng nhập tên địa điểm'],
    trim: true,
    maxlength: [200, 'Tên không quá 200 ký tự']
  },
  type: {
    type: String,
    required: [true, 'Vui lòng chọn loại địa điểm'],
    enum: {
      values: ['hospital', 'school', 'bus_stop', 'park', 'police'],
      message: 'Loại địa điểm không hợp lệ'
    }
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  latitude: {
    type: Number,
    required: [true, 'Thiếu vĩ độ của vị trí'],
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: [true, 'Thiếu kinh độ của vị trí'],
    min: -180,
    max: 180
  },
  // GeoJSON Point [longitude, latitude] cho truy vấn khoảng cách tới bệnh
  // viện/trường học khi tính điểm ưu tiên.
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
  description: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

placeSchema.pre('validate', function(next) {
  if (this.isModified('latitude') || this.isModified('longitude') || this.isNew) {
    if (typeof this.latitude === 'number' && typeof this.longitude === 'number') {
      this.geo = { type: 'Point', coordinates: [this.longitude, this.latitude] };
    }
  }
  next();
});

// Index for common queries
placeSchema.index({ type: 1 });
placeSchema.index({ isActive: 1 });
placeSchema.index({ geo: '2dsphere' });
placeSchema.index({ type: 1, isActive: 1 });

module.exports = mongoose.model('Place', placeSchema);
