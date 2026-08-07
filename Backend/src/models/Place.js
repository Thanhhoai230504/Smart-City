const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Place name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  type: {
    type: String,
    required: [true, 'Place type is required'],
    enum: {
      values: ['hospital', 'school', 'bus_stop', 'park', 'police'],
      message: 'Type must be one of: hospital, school, bus_stop, park, police'
    }
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  latitude: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required'],
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
