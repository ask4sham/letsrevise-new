/**
 * PR-004: EnquiryLog — observability + trust for RAG enquiries.
 */
const mongoose = require("mongoose");

const EnquiryLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.Mixed, default: null },
    role: { type: String, trim: true, default: "" },
    question: { type: String, required: true },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, trim: true, default: null, index: true },
    level: { type: String, trim: true, default: null },
    examBoard: { type: String, trim: true, default: null },
    mode: { type: String, enum: ["lesson", "revision", "exam"], default: null },
    responseMode: { type: String, enum: ["quick", "explain", "exam", "revision"], default: "explain" },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", default: null },
    turnIndex: { type: Number, default: 0 },
    cached: { type: Boolean, default: false },
    retrieval: {
      query: { type: String, default: "" },
      topK: { type: Number, default: 0 },
      results: [
        {
          knowledgeDocumentId: String,
          score: Number,
          sourceType: String,
          sourceId: String,
          topicKey: String,
        },
      ],
    },
    response: {
      explanation: { type: String, default: "" },
      keyPoints: [{ type: String }],
      memoryHook: { type: String, default: "" },
      practice: [
        {
          type: { type: String, enum: ["mcq", "short", "exam", "flashcard"] },
          question: String,
          options: [String],
          answer: String,
          markScheme: String,
          front: String,
          back: String,
        },
      ],
      citations: [
        {
          knowledgeDocumentId: String,
          sourceType: String,
          sourceId: String,
          quote: String,
          reason: String,
        },
      ],
      warnings: [{ type: String }],
    },
    provider: {
      llm: { type: String, default: "" },
      embeddings: { type: String, default: "" },
    },
    tokens: {
      prompt: { type: Number, default: null },
      completion: { type: Number, default: null },
      total: { type: Number, default: null },
    },
    feedback: {
      rating: { type: String, enum: ["up", "down"], default: null },
      comment: { type: String, default: null },
      createdAt: { type: Date, default: null },
    },
    /** PR-016b: Action click analytics (Do now / Go to buttons) */
    actionClicks: [{ actionId: String, at: { type: Date, default: Date.now } }],
    /** PR-021/022: External sources used (for moderation UI) */
    externalUsed: { type: Boolean, default: false, index: true },
    externalSources: [
      {
        url: String,
        title: String,
        domain: String,
      },
    ],
    /** PR-035: External exam context used (query contained exam/past paper/mark scheme etc.) */
    externalExamContextUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EnquiryLogSchema.index({ specKey: 1, topicKey: 1, createdAt: -1 });

module.exports = mongoose.model("EnquiryLog", EnquiryLogSchema);
