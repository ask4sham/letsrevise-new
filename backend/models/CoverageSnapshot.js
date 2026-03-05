/**
 * PR-009: CoverageSnapshot — cached coverage metrics per (specKey, topicKey).
 * TTL 90 days.
 */
const mongoose = require("mongoose");

const TopWeakQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    count: { type: Number, required: true },
  },
  { _id: false }
);

const CoverageSnapshotSchema = new mongoose.Schema(
  {
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    computedAt: { type: Date, required: true },
    windowDays: { type: Number, required: true },
    specStatementsTotal: { type: Number, required: true, default: 0 },
    knowledgeDocsSpec: { type: Number, required: true, default: 0 },
    knowledgeDocsLesson: { type: Number, required: true, default: 0 },
    knowledgeDocsTotal: { type: Number, required: true, default: 0 },
    score: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ["NO_SPEC", "EMPTY", "THIN", "OK", "STRONG"],
    },
    enquiriesTotal: { type: Number, required: true, default: 0 },
    enquiriesWeakEvidence: { type: Number, required: true, default: 0 },
    weakRate: { type: Number, required: true, default: 0 },
    topWeakQuestions: { type: [TopWeakQuestionSchema], default: [] },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

CoverageSnapshotSchema.index({ specKey: 1, topicKey: 1, computedAt: -1 });
CoverageSnapshotSchema.index({ specKey: 1, computedAt: -1 });
CoverageSnapshotSchema.index({ computedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL 90 days

module.exports = mongoose.model("CoverageSnapshot", CoverageSnapshotSchema);
