/**
 * PR-002: KnowledgeDocument — unified retrievable layer for trusted sources.
 * Normalizes SpecStatements and Lesson blocks for AI Tutor retrieval.
 * No embeddings yet (PR-003).
 */
const mongoose = require("mongoose");

const KnowledgeDocumentSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      required: true,
      enum: ["specStatement", "lessonBlock", "lessonDiagram", "externalTrusted", "teacherNote"],
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    specKey: { type: String, required: true, trim: true, index: true },
    examBoard: { type: String, trim: true, default: null, index: true },
    level: { type: String, trim: true, default: null, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    tier: { type: String, trim: true, default: null, index: true },
    title: { type: String, trim: true, default: "" },
    text: { type: String, required: true },
    chunkIndex: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    contentHash: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

KnowledgeDocumentSchema.index(
  { sourceType: 1, sourceId: 1, chunkIndex: 1 },
  { unique: true }
);
KnowledgeDocumentSchema.index({ specKey: 1, topicKey: 1, sourceType: 1 });
KnowledgeDocumentSchema.index({ specKey: 1, sourceType: 1 });

module.exports = mongoose.model("KnowledgeDocument", KnowledgeDocumentSchema);
