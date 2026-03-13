/**
 * PR-PP1: Topic Past Paper Bank — URLs and file uploads.
 */
const mongoose = require("mongoose");

const TopicPastPaperSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    examBoard: { type: String, trim: true, default: "" },
    qualification: { type: String, trim: true, default: "" },
    subject: { type: String, trim: true, default: "" },
    year: { type: Number, default: undefined },
    paper: { type: String, trim: true, default: "" },
    session: { type: String, trim: true, default: "" },
    tier: { type: String, trim: true, default: "" },
    type: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],
    sourceType: { type: String, enum: ["url", "file"], required: true },
    url: { type: String, trim: true, default: "" },
    file: {
      fileId: { type: mongoose.Schema.Types.ObjectId, ref: "FileAsset" },
      originalName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 },
      sha256: { type: String, default: "" },
    },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    fingerprint: { type: String, required: true, index: true },
    officialSource: { type: Boolean, default: false },
    officialHost: { type: String, trim: true, default: "" },
    officialSource: { type: Boolean, default: false },
    officialHost: { type: String, default: "" },
  },
  { timestamps: true }
);

TopicPastPaperSchema.index({ topicKey: 1, status: 1 });
TopicPastPaperSchema.index({ ownerId: 1, topicKey: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model("TopicPastPaper", TopicPastPaperSchema);
