/**
 * PR-EDGE-3.1 / SQ1: Quiz/Assessment assignment — shareable link for lesson quiz or assessment paper.
 */
const mongoose = require("mongoose");
const crypto = require("crypto");

const QuizAssignmentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["quiz", "assessment"],
      required: true,
      index: true,
    },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: "AssessmentPaper", default: null },
    title: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    shareId: { type: String, required: true, unique: true, index: true },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true }
);

function generateShareId() {
  return crypto.randomBytes(12).toString("base64url");
}

QuizAssignmentSchema.statics.generateShareId = generateShareId;

module.exports = mongoose.model("QuizAssignment", QuizAssignmentSchema);
