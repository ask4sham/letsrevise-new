/**
 * PR-001: SpecStatement model — exam-board specification requirements.
 * Trusted knowledge sources for the AI Tutor retrieval system.
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
  },
  { timestamps: true }
);

SpecStatementSchema.index({ specKey: 1, topicKey: 1 });
SpecStatementSchema.index({ specKey: 1, statementCode: 1 });

module.exports = mongoose.model("SpecStatement", SpecStatementSchema);
