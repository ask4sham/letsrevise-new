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
    /** Optional: for shared organisation/school question bank. When set, scope should be "organisation". */
    organisationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
      default: null,
      index: true,
    },
    /** Visibility for attach-by-topic: "teacher" (default) = only owner; "organisation" = org-wide; "platform" = global. */
    scope: {
      type: String,
      enum: ["teacher", "organisation", "platform"],
      default: "teacher",
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
    /** Canonical topic key from taxonomy (e.g. aqa_gcse_biology_topics) for filtering and lesson attachment. */
    topicKey: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    /** Optional unit key from taxonomy (e.g. "cell-biology"). */
    unitKey: {
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
    /** PR-BULK-INGEST-2: Stable hash for dedupe (stem + answer/markscheme + type + marks). */
    fingerprint: {
      type: String,
      default: null,
      index: true,
    },
    /** PR-BULK-INGEST-3: Asset references (images, diagrams, PDFs). */
    assets: [
      {
        type: { type: String, default: "image" },
        mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
        url: { type: String, default: null },
        alt: { type: String, default: null },
      },
    ],
    /** PR-METADATA-1: optional metadata for filtering. */
    difficulty: { type: Number, min: 1, max: 5, default: null },
    skill: { type: String, enum: ["recall", "application", "analysis", "exam-technique"], default: null },
    estimatedTimeSec: { type: Number, min: 1, default: null },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ExamQuestionSchema.index({ teacherId: 1, status: 1 });
ExamQuestionSchema.index({ fingerprint: 1 }, { sparse: true });

module.exports = mongoose.model("ExamQuestion", ExamQuestionSchema);
