/**
 * PR-BULK-INGEST-4: Past paper question — links to PastPaper + namespaced topicKey. Per-owner dedupe.
 */
const mongoose = require("mongoose");

const PastPaperQuestionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pastPaperId: { type: mongoose.Schema.Types.ObjectId, ref: "PastPaper", required: true, index: true },
    specKey: { type: String, required: true, index: true },
    topicKey: { type: String, required: true, index: true },
    questionNumber: { type: String, default: null },
    marks: { type: Number, default: null },
    question: { type: String, required: true },
    markScheme: { type: [String], default: [] },
    assets: [
      {
        type: { type: String, default: "image" },
        mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
        url: { type: String, default: null },
        alt: { type: String, default: null },
      },
    ],
    fingerprint: { type: String, required: true, index: true },
    isArchived: { type: Boolean, default: false },
    /** PR-METADATA-1: optional metadata for filtering. */
    difficulty: { type: Number, min: 1, max: 5, default: null },
    skill: { type: String, enum: ["recall", "application", "analysis", "exam-technique"], default: null },
    estimatedTimeSec: { type: Number, min: 1, default: null },
  },
  { timestamps: true }
);

PastPaperQuestionSchema.index({ ownerId: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model("PastPaperQuestion", PastPaperQuestionSchema);
