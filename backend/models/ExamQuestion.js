// backend/models/ExamQuestion.js
const mongoose = require("mongoose");

const ExamQuestionSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    examBoard: {
      type: String,
      trim: true,
      default: null,
    },
    level: {
      type: String,
      trim: true,
      default: null,
    },
    topic: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["mcq", "short", "label", "table", "data"],
    },
    marks: {
      type: Number,
      default: 1,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      default: [],
    },
    correctIndex: {
      type: Number,
      default: null,
    },
    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    markScheme: {
      type: [String],
      default: [],
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { timestamps: true }
);

ExamQuestionSchema.index({ teacherId: 1, status: 1 });

module.exports = mongoose.model("ExamQuestion", ExamQuestionSchema);
