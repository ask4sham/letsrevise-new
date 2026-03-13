/**
 * PR-006: EnquiryCache — avoid repeated LLM calls for identical queries.
 * TTL index: 24h (configurable).
 */
const mongoose = require("mongoose");

const EnquiryCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    specKey: { type: String, required: true },
    topicKey: { type: String, default: null },
    mode: { type: String, default: null },
    response: {
      question: String,
      usedSources: mongoose.Schema.Types.Mixed,
      answer: mongoose.Schema.Types.Mixed,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

EnquiryCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // 24h TTL
// key already has unique: true in schema — avoid duplicate index warning

module.exports = mongoose.model("EnquiryCache", EnquiryCacheSchema);
