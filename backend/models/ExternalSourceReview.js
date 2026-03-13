/**
 * PR-022: Audit trail for external source moderation decisions.
 */
const mongoose = require("mongoose");

const ExternalSourceReviewSchema = new mongoose.Schema(
  {
    enquiryLogId: { type: mongoose.Schema.Types.ObjectId, ref: "EnquiryLog", required: true, index: true },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, trim: true, default: null, index: true },
    url: { type: String, trim: true, default: null },
    domain: { type: String, trim: true, default: null },
    title: { type: String, trim: true, default: null },
    decision: {
      type: String,
      required: true,
      enum: ["promoted", "denied", "allowed", "ignored"],
      index: true,
    },
    note: { type: String, trim: true, default: null },
    decidedBy: { type: mongoose.Schema.Types.Mixed, required: true },
    decidedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ExternalSourceReviewSchema.index({ specKey: 1, topicKey: 1, decidedAt: -1 });

module.exports = mongoose.model("ExternalSourceReview", ExternalSourceReviewSchema);
