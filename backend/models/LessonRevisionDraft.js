// backend/models/LessonRevisionDraft.js — Phase 9E AI revision pipeline
// One draft per lesson; draft-only visibility (owner/admin); apply copies to lesson.
const mongoose = require("mongoose");

const LessonRevisionDraftSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, unique: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Normalized flashcards (same shape as Lesson.flashcards after validateRevision) */
    flashcards: { type: mongoose.Schema.Types.Mixed, default: [] },
    /** Normalized quiz (same shape as Lesson.quiz after validateRevision) */
    quiz: { type: mongoose.Schema.Types.Mixed, default: null },
    /** draft = editable; applied = has been copied to lesson (kept for audit) */
    status: {
      type: String,
      enum: ["draft", "applied"],
      default: "draft",
      index: true,
    },
    /** Phase 9F: engine run telemetry (status, errorCode, jobId, rolloutBucket, etc.) for debugging. */
    engine: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LessonRevisionDraft || mongoose.model("LessonRevisionDraft", LessonRevisionDraftSchema);
