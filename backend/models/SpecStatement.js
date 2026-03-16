/**
 * PR-001: SpecStatement model — exam-board specification requirements.
 * Trusted knowledge sources for the AI Tutor retrieval system.
 *
 * Extended for Spec Document Ingestion:
 * - subject, mainTopicKey, sectionKey, statementType
 * - sourceDocumentName, sourceDocumentVersion, sourcePageNumber, sourceSectionHeading
 * - canonicalStatementKey (for dedupe; statementCode remains for backward compat)
 */
const mongoose = require("mongoose");

const SpecStatementSchema = new mongoose.Schema(
  {
    specKey: { type: String, required: true, trim: true, index: true },
    examBoard: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    statementCode: { type: String, required: true, trim: true },
    statementText: { type: String, required: true, trim: true },
    tier: { type: String, trim: true, default: null },
    tags: [{ type: String, trim: true }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Ingestion extensions (optional)
    subject: { type: String, trim: true, default: null },
    mainTopicKey: { type: String, trim: true, default: null },
    sectionKey: { type: String, trim: true, default: null },
    statementType: {
      type: String,
      enum: ["core", "required_practical", "maths_skill", "exam_skill", "other"],
      default: "core",
    },
    sourceDocumentName: { type: String, trim: true, default: null, index: true },
    sourceDocumentVersion: { type: String, trim: true, default: null },
    sourcePageNumber: { type: Number, default: null },
    sourceSectionHeading: { type: String, trim: true, default: null },
    canonicalStatementKey: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

SpecStatementSchema.index({ specKey: 1, topicKey: 1 });
SpecStatementSchema.index({ specKey: 1, statementCode: 1 });
SpecStatementSchema.index({ specKey: 1, canonicalStatementKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("SpecStatement", SpecStatementSchema);
