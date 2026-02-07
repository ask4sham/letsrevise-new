// backend/models/AssessmentItem.js
const mongoose = require("mongoose");

const AssessmentItemSchema = new mongoose.Schema(
  {
    // Basic identification
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    
    // Classification (similar to AssessmentPaper)
    subject: {
      type: String,
      required: true,
      enum: ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Geography", "Computer Science", "Other"],
    },
    examBoard: {
      type: String,
      enum: ["AQA", "Edexcel", "OCR", "CIE", "WJEC", "Other", null],
      default: null,
    },
    level: {
      type: String,
      enum: ["GCSE", "A-Level", "IB", "KS3", "Other"],
      required: true,
    },
    
    // Item type
    type: {
      type: String,
      enum: [
        "multiple-choice", 
        "short-answer", 
        "essay", 
        "problem-solving", 
        "practical", 
        "other",
        "mcq",
        "short",
        "label",
        "table",
        "data"
      ],
      required: true,
    },
    
    // Content
    question: {
      type: String,
      required: true,
    },
    options: [String], // For multiple choice
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    correctAnswer: mongoose.Schema.Types.Mixed, // Can be string, number, array, etc.
    markScheme: {
      type: [String],
      default: [],
    },
    explanation: String,
    marks: {
      type: Number,
      default: 1,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    
    // Metadata
    isPublished: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Tags for searchability
    tags: [String],
    
    // Usage statistics
    timesUsed: {
      type: Number,
      default: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    
    // Reference to parent paper if applicable
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentPaper",
      default: null,
    },
    
    // Order in paper
    questionNumber: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
AssessmentItemSchema.index({ subject: 1, level: 1, type: 1 });
AssessmentItemSchema.index({ createdBy: 1 });
AssessmentItemSchema.index({ isPublished: 1 });
AssessmentItemSchema.index({ paperId: 1 });

module.exports = mongoose.model("AssessmentItem", AssessmentItemSchema);