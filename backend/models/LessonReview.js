// backend/models/LessonReview.js — Phase 9D teacher review workflow
const mongoose = require("mongoose");

const LessonReviewSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

LessonReviewSchema.index({ lessonId: 1, createdAt: -1 });

module.exports = mongoose.models.LessonReview || mongoose.model("LessonReview", LessonReviewSchema);
