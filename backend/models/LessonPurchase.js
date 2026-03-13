/**
 * Phase 9C — Purchase ledger: one row per (user, lesson) for idempotency + audit.
 * Unique (userId, lessonId) → buy once. Unique (userId, idempotencyKey) → replay protection.
 */
const mongoose = require("mongoose");

const lessonPurchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true },
    cost: { type: Number, required: true },
    idempotencyKey: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

lessonPurchaseSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
lessonPurchaseSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model("LessonPurchase", lessonPurchaseSchema);
