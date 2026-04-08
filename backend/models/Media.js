/**
 * PR-BULK-INGEST-3: Media metadata + SHA-256 for dedupe. Local storage (or S3 later).
 */
const mongoose = require("mongoose");

const MediaSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sha256: { type: String, required: true, index: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: null },
    storage: { type: String, default: "local" }, // "local" | "supabase" | "r2"
    path: { type: String, required: true }, // e.g. "uploads/<sha>.png"
    url: { type: String, required: true }, // e.g. "/uploads/<sha>.png"
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

MediaSchema.index({ ownerId: 1, sha256: 1 }, { unique: true });

module.exports = mongoose.model("Media", MediaSchema);
