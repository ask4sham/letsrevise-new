/**
 * Audit trail for LetsRevise Approved catalogue workflow (approved-lessons-v1).
 * Keeps approval history out of the Lesson document.
 */
const mongoose = require("mongoose");

const LESSON_APPROVAL_ACTIONS = ["submitted", "approved", "rejected", "retired", "resubmitted"];

const LessonApprovalSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    action: { type: String, enum: LESSON_APPROVAL_ACTIONS, required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
    internalNotes: { type: String, default: "" },
    previousStatus: { type: String, default: "none" },
    newStatus: { type: String, required: true },
  },
  { timestamps: true }
);

LessonApprovalSchema.index({ lessonId: 1, createdAt: -1 });

module.exports =
  mongoose.models.LessonApproval || mongoose.model("LessonApproval", LessonApprovalSchema);
module.exports.LESSON_APPROVAL_ACTIONS = LESSON_APPROVAL_ACTIONS;
