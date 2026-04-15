/**
 * Background job: AI checkpoint generation after lesson publish (drafts + optional auto-apply).
 * Polled by workers/checkpointGenerationWorker.js — same pattern as KNOWLEDGE_REFRESH.
 */
const mongoose = require("mongoose");

const CheckpointGenerationJobSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    specKey: { type: String, trim: true, default: "", index: true },
    topicKey: { type: String, trim: true, default: null, index: true },
    trigger: { type: String, default: "publish", trim: true },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    /**
     * After completion: whether checkpoints were merged into lesson pages or await teacher.
     */
    reviewStatus: {
      type: String,
      enum: ["pending_review", "auto_applied", "applied_manually", "rejected", "none"],
      default: "none",
    },
    attempts: { type: Number, default: 0 },
    logs: [
      {
        at: { type: Date, default: Date.now },
        msg: { type: String, default: "" },
      },
    ],
    error: { type: String, default: null },
    /** 0–1 aggregate from validation rules */
    qualityScore: { type: Number, default: null },
    validationIssues: [
      {
        severity: { type: String, enum: ["error", "warning"], default: "warning" },
        code: { type: String, default: "" },
        message: { type: String, default: "" },
      },
    ],
    usage: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
      model: { type: String, default: "" },
      /** Optional cost estimate in USD (provider-specific) */
      estimatedUsd: { type: Number, default: null },
    },
    /** Normalised checkpoint items + raw model output summary */
    resultPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

CheckpointGenerationJobSchema.index({ status: 1, createdAt: 1 });
CheckpointGenerationJobSchema.index({ lessonId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("CheckpointGenerationJob", CheckpointGenerationJobSchema);
