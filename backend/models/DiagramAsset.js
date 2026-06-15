/**
 * P2.1 — Reusable diagram asset (ChatGPT-first / upload-first).
 * One asset → many lesson block references via diagramAssetId.
 */
const mongoose = require("mongoose");

const HotspotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    label: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const DragDropTargetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    x: { type: Number },
    y: { type: Number },
    width: { type: Number },
    height: { type: Number },
    correctLabel: { type: String, default: "" },
    pairId: { type: String, default: "" },
  },
  { _id: false }
);

const DiagramAssetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, default: "Biology", trim: true },
    topic: { type: String, default: "", trim: true },
    examBoard: { type: String, default: "AQA", trim: true },
    tier: { type: String, default: "Higher", trim: true },
    keywords: { type: [String], default: [] },

    imageUrl: { type: String, required: true },
    originalImageUrl: { type: String },
    mimeType: { type: String, default: "image/png" },
    storage: { type: String, default: "supabase" },

    activityTypes: {
      type: [String],
      default: ["view"],
      enum: ["view", "hotspot", "dragdrop", "tti"],
    },

    hotspots: { type: [HotspotSchema], default: [] },
    dragDropTargets: { type: [DragDropTargetSchema], default: [] },

    /** TTI / drag-drop geometry hints — full contract lives on lesson block at attach time */
    ttiGeometryVersion: { type: String, default: "tti-box-geometry-v1" },

    source: {
      type: String,
      enum: ["chatgpt", "upload", "catalogue", "import"],
      default: "upload",
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isShared: { type: Boolean, default: false },
    usageCount: { type: Number, default: 0 },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

DiagramAssetSchema.index({ subject: 1, topic: 1 });
DiagramAssetSchema.index({ keywords: 1 });
DiagramAssetSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model("DiagramAsset", DiagramAssetSchema);
