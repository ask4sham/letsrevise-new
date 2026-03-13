/**
 * PR-015: Background job queue (Mongo) for async tasks.
 * Used for KNOWLEDGE_REFRESH: reindex → embed → coverage.
 */
const mongoose = require("mongoose");

const BackgroundJobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["KNOWLEDGE_REFRESH"], index: true },
    status: { type: String, enum: ["queued", "running", "completed", "failed"], default: "queued", index: true },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, trim: true, default: null, index: true },
    sourceTypes: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    attempts: { type: Number, default: 0 },
    logs: [
      {
        at: { type: Date, default: Date.now },
        msg: { type: String, default: "" },
      },
    ],
    error: { type: String, default: null },
  },
  { timestamps: true }
);

BackgroundJobSchema.index({ status: 1, createdAt: 1 });
BackgroundJobSchema.index({ type: 1, status: 1, specKey: 1, topicKey: 1 });
BackgroundJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL 30d

module.exports = mongoose.model("BackgroundJob", BackgroundJobSchema);
