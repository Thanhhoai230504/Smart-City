const mongoose = require('mongoose');

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
  imageUrl: {
    type: String,
    default: null
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
  voteCount: {
    type: Number,
    default: 0
  },
  statusHistory: [{
    status: { type: String, enum: ['reported', 'processing', 'resolved', 'rejected'] },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, default: '' }
  }]
}, {
  timestamps: true
});

// Indexes for common queries
issueSchema.index({ status: 1 });
issueSchema.index({ category: 1 });
issueSchema.index({ userId: 1 });
issueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Issue', issueSchema);
