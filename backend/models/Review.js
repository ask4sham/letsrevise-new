// models/Review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    maxlength: 1000
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  reported: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster queries
reviewSchema.index({ lessonId: 1, createdAt: -1 });
reviewSchema.index({ teacherId: 1, createdAt: -1 });
reviewSchema.index({ studentId: 1, createdAt: -1 });

// Update the updatedAt field before saving
reviewSchema.pre('save', async function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Review', reviewSchema);