// backend/models/AssessmentItem.js
const mongoose = require("mongoose");

/**
 * AssessmentItem Schema
 * Phase 1: Minimal exam-style questions (short answer and MCQ)
 * - Separate from Lesson.quiz to avoid breaking existing flows
 * - Supports filtering by subject, topic, type, published status
 */

const AssessmentItemSchema = new mongoose.Schema(
  {
    // Creator information
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByRole: {
      type: String,
      enum: ["admin", "teacher"],
      required: true,
    },

    // Classification fields
    examBoard: {
      type: String,
      default: "AQA",
    },
    subject: {
      type: String,
      required: true,
    },
    topic: {
      type: String,
      required: true,
    },
    subtopic: {
      type: String,
      default: "",
    },
    level: {
      type: String,
      default: "GCSE",
    },

    // Question type and content
    type: {
      type: String,
      enum: ["short", "mcq"],
      required: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 1,
    },

    // Short answer fields
    correctAnswer: {
      type: String,
      required: function () {
        return this.type === "short";
      },
    },
    markSchemeText: {
      type: String,
      default: "",
    },

    // MCQ fields
    options: {
      type: [String],
      validate: {
        validator: function (v) {
          if (this.type === "mcq") {
            return Array.isArray(v) && v.length >= 2 && v.length <= 6;
          }
          return true; // Not required for short type
        },
        message: "MCQ questions must have 2-6 options",
      },
      default: [],
    },
    correctIndex: {
      type: Number,
      validate: {
        validator: function (v) {
          if (this.type === "mcq") {
            return (
              Number.isInteger(v) &&
              v >= 0 &&
              v < (this.options?.length || 0)
            );
          }
          return true; // Not required for short type
        },
        message: "correctIndex must be valid for options array",
      },
      default: null,
    },

    // Metadata
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    tags: {
      type: [String],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for common queries
AssessmentItemSchema.index({ subject: 1, topic: 1, type: 1, isPublished: 1 });
AssessmentItemSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("AssessmentItem", AssessmentItemSchema);
