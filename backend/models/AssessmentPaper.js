// backend/models/AssessmentPaper.js
const mongoose = require("mongoose");

/**
 * =====================================================
 * AssessmentPaper Schema
 * - Container for AssessmentItems (Past Papers / Mock Exams / Practice Sets)
 * - Phase 2: Backend scaffolding only
 * =====================================================
 */

const AssessmentPaperItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentItem",
      required: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    marksOverride: {
      type: Number,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const AssessmentPaperSchema = new mongoose.Schema(
  {
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
    isPublished: {
      type: Boolean,
      default: false,
    },
    kind: {
      type: String,
      enum: ["past_paper", "mock_exam", "practice_set"],
      required: true,
    },
    examBoard: {
      type: String,
      default: "AQA",
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      default: "GCSE",
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
    },
    series: {
      type: String,
      trim: true, // "June", "Nov"
    },
    paperNumber: {
      type: String,
      trim: true, // "Paper 1"
    },
    tier: {
      type: String,
      enum: ["foundation", "higher", "mixed"],
      default: "mixed",
    },
    timeSeconds: {
      type: Number,
      default: 3600,
    },
    items: {
      type: [AssessmentPaperItemSchema],
      default: [],
    },
    questionBankIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ExamQuestion" }],
      default: [],
    },
    totalMarks: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
AssessmentPaperSchema.index({ subject: 1, examBoard: 1, level: 1, kind: 1, isPublished: 1 });
AssessmentPaperSchema.index({ createdBy: 1, createdAt: -1 });

// Allow empty items if questionBankIds has entries; otherwise items must have valid itemIds
AssessmentPaperSchema.path("items").validate(function (items) {
  if (!Array.isArray(items)) return false;
  const hasBank = Array.isArray(this.questionBankIds) && this.questionBankIds.length > 0;
  if (items.length === 0) return hasBank;
  return items.every((it) => mongoose.Types.ObjectId.isValid(String(it.itemId)));
}, "Invalid itemId in items");

// ✅ UPDATED: Save hook - no next parameter, throws error instead
AssessmentPaperSchema.pre("save", function () {
  const items = Array.isArray(this.items) ? this.items : [];

  const ids = items.map((it) => String(it.itemId));
  const unique = new Set(ids);

  if (unique.size !== ids.length) {
    throw new Error("Duplicate itemId in items");
  }
});

// Virtual: compute totalMarks if not provided
AssessmentPaperSchema.virtual("computedTotalMarks").get(function () {
  if (this.totalMarks !== undefined && this.totalMarks !== null) {
    return this.totalMarks;
  }
  if (!this.items || this.items.length === 0) {
    return 0;
  }
  // Sum marksOverride if provided, otherwise would need to fetch from AssessmentItem
  // For now, return null to indicate it needs to be computed from populated items
  return null;
});

// Ensure virtuals are included in JSON
AssessmentPaperSchema.set("toJSON", { virtuals: true });
AssessmentPaperSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("AssessmentPaper", AssessmentPaperSchema);