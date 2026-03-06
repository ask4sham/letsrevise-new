/**
 * PR-Q1: Topic-level Quiz Bank (MCQ + short-answer). PR-QUIZ-BANK-TYPES-1: type, short-answer fields, metadata.
 */
const mongoose = require("mongoose");

const TopicQuizQuestionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    /** Optional spec key (e.g. aqa-gcse-biology). Derivable from namespaced topicKey. */
    specKey: { type: String, trim: true, default: null, index: true },
    type: { type: String, enum: ["mcq", "short-answer"], default: "mcq", index: true },
    questionText: { type: String, required: true, trim: true },
    choices: [{ type: String, trim: true }],
    correctIndex: { type: Number, default: 0 },
    acceptableAnswers: [{ type: String, trim: true }],
    matchMode: { type: String, enum: ["exact", "contains"], default: "contains" },
    explanation: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],
    difficulty: { type: Number, min: 1, max: 5, default: null },
    skill: { type: String, enum: ["recall", "application", "analysis", "exam-technique"], default: null },
    estimatedTimeSec: { type: Number, min: 1, default: null },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    kind: { type: String, enum: ["quiz", "assessment"], default: "quiz", index: true },
    fingerprint: { type: String, required: true, index: true },
    isArchived: { type: Boolean, default: false },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    /** PR-014.1: generatedFrom { jobId, statementCodes, seed } for publish gate */
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

TopicQuizQuestionSchema.index({ topicKey: 1, status: 1 });
TopicQuizQuestionSchema.index({ topicKey: 1, kind: 1, status: 1, type: 1 });
TopicQuizQuestionSchema.index({ ownerId: 1, topicKey: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model("TopicQuizQuestion", TopicQuizQuestionSchema);
