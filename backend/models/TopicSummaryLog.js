/**
 * PR-024: TopicSummaryLog — audit trail for topic summaries.
 */
const mongoose = require("mongoose");

const TopicSummaryLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.Mixed, default: null },
    role: { type: String, trim: true, default: "" },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    mode: {
      type: String,
      enum: ["overview", "lessonPlan", "revisionSheet", "examFocus"],
      default: "overview",
    },
    allowExternal: { type: Boolean, default: false },
    retrieval: {
      usedSources: [
        {
          knowledgeDocumentId: String,
          sourceType: String,
          sourceId: mongoose.Schema.Types.Mixed,
          score: Number,
          title: String,
          topicKey: String,
        },
      ],
      topScore: Number,
      sourceCounts: {
        spec: Number,
        lesson: Number,
        note: Number,
        external: Number,
        total: Number,
      },
    },
    response: {
      summary: { type: String, default: "" },
      keyPoints: [{ type: String }],
      sections: { type: mongoose.Schema.Types.Mixed, default: {} },
      citations: [
        {
          knowledgeDocumentId: String,
          sourceType: String,
          sourceId: String,
          quote: String,
          reason: String,
          externalUrl: String,
        },
      ],
      warnings: [{ type: String }],
      confidenceLevel: { type: String, default: "" },
      confidenceReason: { type: String, default: "" },
    },
    provider: {
      llmProvider: { type: String, default: "" },
      llmModel: { type: String, default: "" },
      embeddingsProvider: { type: String, default: "" },
    },
    tokens: {
      input: { type: Number, default: null },
      output: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

TopicSummaryLogSchema.index({ specKey: 1, topicKey: 1, createdAt: -1 });
TopicSummaryLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("TopicSummaryLog", TopicSummaryLogSchema);
