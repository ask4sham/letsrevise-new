/**
 * StudentTopicReviewState — spaced repetition state per student/topic.
 * Used by adaptiveRevisionService for due/overdue scheduling.
 * Does NOT replace canonical mastery (LearningEvidenceEvent).
 */
const mongoose = require("mongoose");

const StudentTopicReviewStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null },
    intervalDays: { type: Number, default: 1 },
    easeFactor: { type: Number, default: 1.3 },
    lastDifficultyRating: { type: Number, min: 1, max: 5, default: null },
    successCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

StudentTopicReviewStateSchema.index({ userId: 1, specKey: 1, topicKey: 1 }, { unique: true });
StudentTopicReviewStateSchema.index({ userId: 1, specKey: 1, nextReviewAt: 1 });

module.exports = mongoose.model("StudentTopicReviewState", StudentTopicReviewStateSchema);
