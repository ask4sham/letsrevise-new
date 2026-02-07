// backend/models/AssessmentAttempt.js
const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "AssessmentItem",
    },

    // MCQ answers (legacy)
    selectedIndex: {
      type: Number,
      default: null,
    }, // null = unanswered

    // Short-answer support (new)
    textAnswer: {
      type: String,
      default: null, // null = unanswered
      trim: true,
      maxlength: 10000, // Changed from 2000 to 10000
    },

    answeredAt: {
      type: Date,
    },
  },
  { _id: false }
);

const AssessmentAttemptSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentPaper",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["in_progress", "submitted", "expired"],
      default: "in_progress",
      index: true,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
    },

    durationSeconds: {
      type: Number,
      required: true,
    },
    timeUsedSeconds: {
      type: Number,
      default: 0,
    },

    answers: {
      type: [AnswerSchema],
      default: [],
    },

    score: {
      totalQuestions: {
        type: Number,
        default: 0,
      },
      answered: {
        type: Number,
        default: 0,
      },
      correct: {
        type: Number,
        default: 0,
      },
      percentage: {
        type: Number,
        default: 0,
      },
    },

    autoSubmitted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent multiple in-progress attempts per student per paper
AssessmentAttemptSchema.index(
  { studentId: 1, paperId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "in_progress" } }
);

module.exports = mongoose.model("AssessmentAttempt", AssessmentAttemptSchema);