/**
 * PR-EDGE-3.1 / SQ1: Quiz/Assessment attempt — student submission on a QuizAssignment.
 */
const mongoose = require("mongoose");

const QuizAttemptSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizAssignment",
      required: true,
      index: true,
    },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    studentName: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "SUBMITTED", "MARKED"],
      default: "IN_PROGRESS",
      index: true,
    },
    isReleased: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
    /** PR-EDGE-4.2: MCQ score (lesson-based); only meaningful when status=SUBMITTED/MARKED */
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    /** Answers snapshot for MCQ scoring: [{ questionId, selectedIndex }] */
    answers: { type: [Object], default: [] },
    /** PR-EDGE-4.2 hardening: random token required for submit (avoids guessable attemptId bearer) */
    attemptToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

QuizAttemptSchema.index({ assignmentId: 1, submittedAt: -1 });

module.exports = mongoose.model("QuizAttempt", QuizAttemptSchema);
