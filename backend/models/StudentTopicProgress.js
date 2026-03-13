/**
 * PR-038: StudentTopicProgress — tracks student mastery by topic.
 * Deterministic scoring from activity signals; used for study plan recommendations.
 */
const mongoose = require("mongoose");

const SignalsSchema = new mongoose.Schema(
  {
    lessonViews: { type: Number, default: 0 },
    aiEnquiries: { type: Number, default: 0 },
    weakAiEnquiries: { type: Number, default: 0 },
    topicSummaries: { type: Number, default: 0 },
    practiceAttempts: { type: Number, default: 0 },
    practiceCorrect: { type: Number, default: 0 },
    flashcardReviews: { type: Number, default: 0 },
    lastActivityAt: { type: Date },
  },
  { _id: false }
);

const RecommendationsSchema = new mongoose.Schema(
  {
    nextAction: {
      type: String,
      enum: ["viewLesson", "summarise", "practice", "reviseFlashcards", "askAi"],
    },
    reason: { type: String },
    updatedAt: { type: Date },
  },
  { _id: false }
);

const StudentTopicProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    masteryScore: { type: Number, default: 0 },
    confidenceBand: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },
    status: {
      type: String,
      enum: ["new", "learning", "practising", "secure"],
      default: "new",
    },
    signals: { type: SignalsSchema, default: () => ({}) },
    recommendations: { type: RecommendationsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

StudentTopicProgressSchema.index({ userId: 1, specKey: 1, topicKey: 1 }, { unique: true });
StudentTopicProgressSchema.index({ userId: 1, specKey: 1, masteryScore: 1 });
StudentTopicProgressSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("StudentTopicProgress", StudentTopicProgressSchema);
