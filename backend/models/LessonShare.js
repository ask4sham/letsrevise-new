/**
 * LessonShare — explicit peer review grants (Share for Review).
 * Separate from lesson ownership; does not copy or transfer the lesson.
 */
const mongoose = require("mongoose");

const LESSON_SHARE_PERMISSIONS = ["VIEW", "TEACH"];
const LESSON_SHARE_STATUSES = ["active", "revoked"];

const LessonShareSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    permission: {
      type: String,
      enum: LESSON_SHARE_PERMISSIONS,
      default: "VIEW",
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: LESSON_SHARE_STATUSES,
      default: "active",
      index: true,
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

LessonShareSchema.index({ lessonId: 1, teacherId: 1 }, { unique: true });
LessonShareSchema.index({ teacherId: 1, status: 1, sharedAt: -1 });

module.exports =
  mongoose.models.LessonShare || mongoose.model("LessonShare", LessonShareSchema);
module.exports.LESSON_SHARE_PERMISSIONS = LESSON_SHARE_PERMISSIONS;
module.exports.LESSON_SHARE_STATUSES = LESSON_SHARE_STATUSES;
