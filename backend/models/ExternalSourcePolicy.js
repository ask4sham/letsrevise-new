/**
 * PR-022: External source moderation policy (allowed/denied by URL or domain).
 * Denied overrides everything. Default is neutral (not listed).
 */
const mongoose = require("mongoose");

const ExternalSourcePolicySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: ["url", "domain"],
      index: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["allowed", "denied"],
      index: true,
    },
    reason: { type: String, trim: true, default: null },
    createdBy: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

ExternalSourcePolicySchema.index({ kind: 1, value: 1 }, { unique: true });
ExternalSourcePolicySchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("ExternalSourcePolicy", ExternalSourcePolicySchema);
