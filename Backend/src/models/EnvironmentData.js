const mongoose = require('mongoose');

const environmentDataSchema = new mongoose.Schema({
  location: {
    type: String,
    required: [true, 'Location name is required'],
    trim: true
  },
  source: {
    type: String,
    required: true,
    default: 'OpenWeatherMap'
  },
  temperature: {
    type: Number,
    required: [true, 'Temperature is required']
  },
  humidity: {
    type: Number,
    required: [true, 'Humidity is required'],
    min: 0,
    max: 100
  },
  weatherCondition: {
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
  }
}, {
  timestamps: { createdAt: true, updatedAt: false } // Only track creation time
});

// Index for time-based queries
environmentDataSchema.index({ createdAt: -1 });
environmentDataSchema.index({ location: 1, createdAt: -1 });

module.exports = mongoose.model('EnvironmentData', environmentDataSchema);
