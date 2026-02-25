/**
 * PR-PRACTICE-LOOP-1: Student practice attempt — self-mark outcome + optional confidence.
 * topicKey stored namespaced (specKey:topicKey).
 * Legacy: lesson-scoped attempts (POST /api/attempts) use lessonId, userId, source, isCorrect.
 * Slice 1: contentType + contentId + isCorrect (quiz_mcq, quiz_short, exam_question, past_paper_question).
 */
const mongoose = require("mongoose");

const CONTENT_TYPES = ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"];

const PracticeAttemptSchema = new mongoose.Schema(
  {
    // New schema (topic-based)
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    specKey: { type: String, required: false, trim: true, index: true },
    topicKey: { type: String, required: false, trim: true, index: true },
    sourceType: {
      type: String,
      required: false,
      enum: ["examQuestion", "pastPaperQuestion"],
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },
    outcome: {
      type: String,
      required: false,
      enum: ["correct", "partial", "wrong"],
      index: true,
    },
    // PR-PRACTICE-LOOP-1 Slice 1: unified content reference + boolean correctness
    contentType: {
      type: String,
      required: false,
      enum: CONTENT_TYPES,
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      index: true,
    },
    isCorrect: { type: Boolean, required: false },
    timeSpentSec: { type: Number, required: false, min: 0 },
    // Legacy schema (lesson-scoped, POST /api/attempts)
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: false,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    source: { type: String, required: false, trim: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, required: false, index: true },
    questionType: { type: String, required: false, trim: true },
    selected: { type: String, required: false },
    answerText: { type: String, required: false },
    isCorrect: { type: Boolean, required: false },
    confidence: { type: Number, min: 1, max: 3, default: null },
  },
  { timestamps: true }
);

PracticeAttemptSchema.index({ teacherId: 1, specKey: 1, topicKey: 1, createdAt: -1 });
PracticeAttemptSchema.index({ studentId: 1, createdAt: -1 });
PracticeAttemptSchema.index({ lessonId: 1, createdAt: -1 });
PracticeAttemptSchema.index({ userId: 1, lessonId: 1, questionId: 1, createdAt: -1 });

PracticeAttemptSchema.pre("validate", function (next) {
  const hasLegacy = this.lessonId != null && this.userId != null && this.source != null && typeof this.isCorrect === "boolean";
  const hasNew =
    this.studentId != null &&
    this.teacherId != null &&
    this.specKey &&
    this.topicKey &&
    this.sourceType &&
    this.sourceId != null &&
    this.outcome;
  const hasSlice1 =
    this.studentId != null &&
    this.teacherId != null &&
    this.specKey &&
    this.topicKey &&
    this.contentType &&
    this.contentId != null &&
    typeof this.isCorrect === "boolean";
  if (hasLegacy || hasNew || hasSlice1) {
    if (typeof next === "function") return next();
    return;
  }
  this.invalidate(
    "schema",
    "PracticeAttempt: provide legacy (lessonId, userId, source, isCorrect), new (studentId, teacherId, specKey, topicKey, sourceType, sourceId, outcome), or slice1 (studentId, teacherId, specKey, topicKey, contentType, contentId, isCorrect)"
  );
  if (typeof next === "function") return next();
});

module.exports = mongoose.model("PracticeAttempt", PracticeAttemptSchema);
module.exports.CONTENT_TYPES = CONTENT_TYPES;
