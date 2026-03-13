/**
 * PR-024: TopicSummaryCache — 24h TTL cache for topic summaries.
 * Key: sha256(specKey|topicKey|mode|maxSources|allowExternal)
 */
const mongoose = require("mongoose");

const TopicSummaryCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    specKey: { type: String, required: true },
    topicKey: { type: String, required: true },
    mode: { type: String, required: true },
    response: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TopicSummaryCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // 24h TTL
// key already has unique: true in schema — avoid duplicate index warning

module.exports = mongoose.model("TopicSummaryCache", TopicSummaryCacheSchema);
