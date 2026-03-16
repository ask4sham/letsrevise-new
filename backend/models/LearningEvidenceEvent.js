/**
 * LearningEvidenceEvent — student performance signals linked to topicKey.
 * Captures quiz attempts, flashcard reviews, exam question attempts, lesson completions.
 */
const mongoose = require("mongoose");

const EVENT_TYPES = ["quiz_attempt", "flashcard_review", "exam_question_attempt", "lesson_completion"];
const CONTENT_TYPES = ["quiz", "flashcard", "examQuestion"];

const LearningEvidenceEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    specKey: { type: String, required: true, trim: true },
    topicKey: { type: String, required: true, trim: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    contentType: {
      type: String,
      enum: CONTENT_TYPES,
      default: null,
    },
    contentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    correct: { type: Boolean, default: null },
    score: { type: Number, default: null },
    timeSpentSeconds: { type: Number, default: null },
    difficultyRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

LearningEvidenceEventSchema.index({ specKey: 1, topicKey: 1 });
LearningEvidenceEventSchema.index({ eventType: 1 });
LearningEvidenceEventSchema.index({ userId: 1 });
LearningEvidenceEventSchema.index({ createdAt: -1 });
// Per-user topic queries (dashboard, progress mastery view)
LearningEvidenceEventSchema.index({ userId: 1, specKey: 1, topicKey: 1 });

module.exports = mongoose.model("LearningEvidenceEvent", LearningEvidenceEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.CONTENT_TYPES = CONTENT_TYPES;
