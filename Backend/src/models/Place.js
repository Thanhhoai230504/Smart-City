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

// Index for common queries
placeSchema.index({ type: 1 });
placeSchema.index({ isActive: 1 });

module.exports = mongoose.model('Place', placeSchema);
