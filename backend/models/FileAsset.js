/**
 * PR-PP1: File storage metadata for past paper uploads.
 */
const mongoose = require("mongoose");

const FileAssetSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storage: { type: String, enum: ["local"], default: "local" },
    path: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

FileAssetSchema.index({ ownerId: 1, sha256: 1 });

module.exports = mongoose.model("FileAsset", FileAssetSchema);
