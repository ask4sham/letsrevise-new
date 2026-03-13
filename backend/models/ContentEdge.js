/**
 * Content Graph Layer — ContentEdge model.
 * Represents a directed relationship between two ContentNodes.
 *
 * Index notes (production): Mongoose builds indexes on first model use. No one-time build required.
 */
const mongoose = require("mongoose");

const EDGE_TYPES = [
  "contains",
  "belongs_to",
  "covers",
  "teaches",
  "uses",
  "derived_from",
  "references",
  "revision_of",
  "reports_issue_on",
  "recommended_for",
];

const SOURCE_TYPES = ["system", "migration", "teacher", "admin", "ai"];

const ContentEdgeSchema = new mongoose.Schema(
  {
    fromNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "ContentNode", required: true, index: true },
    toNodeId: { type: mongoose.Schema.Types.ObjectId, ref: "ContentNode", required: true, index: true },
    edgeType: { type: String, enum: EDGE_TYPES, required: true, index: true },
    strength: { type: Number, default: 1 },
    sourceType: { type: String, enum: SOURCE_TYPES, default: "system", index: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    notes: { type: String, trim: true, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ContentEdgeSchema.index({ fromNodeId: 1, edgeType: 1 });
ContentEdgeSchema.index({ toNodeId: 1, edgeType: 1 });
// Compound unique prevents duplicate edges (race-safe with ensureEdge upsert).
ContentEdgeSchema.index({ fromNodeId: 1, toNodeId: 1, edgeType: 1 }, { unique: true });

module.exports = mongoose.model("ContentEdge", ContentEdgeSchema);
module.exports.EDGE_TYPES = EDGE_TYPES;
module.exports.SOURCE_TYPES = SOURCE_TYPES;
