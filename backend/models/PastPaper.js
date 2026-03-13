/**
 * PR-BULK-INGEST-4: Past paper metadata + PDF reference. Per-owner dedupe by fingerprint.
 */
const mongoose = require("mongoose");

const PastPaperSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    specKey: { type: String, required: true, index: true },
    subject: { type: String, default: null },
    examBoard: { type: String, required: true },
    level: { type: String, required: true },
    year: { type: String, required: true },
    series: { type: String, default: null },
    paperCode: { type: String, required: true },
    tier: { type: String, default: null },
    title: { type: String, default: null },
    notes: { type: String, default: null },
    pdf: {
      mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
      url: { type: String, default: null },
      mimeType: { type: String, default: "application/pdf" },
    },
    fingerprint: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

PastPaperSchema.index({ ownerId: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model("PastPaper", PastPaperSchema);
