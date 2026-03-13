/**
 * PR — Adaptive Testing Loop: TopicMastery
 * Tracks student quiz mastery per topicKey (e.g. aqa-gcse-biology:cell-structure).
 * masteryScore = correct / attempts (0–1).
 */
const mongoose = require("mongoose");

const TopicMasterySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User", index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    masteryScore: { type: Number, default: 0 }, // correct / attempts, 0–1
  },
  { timestamps: true }
);

TopicMasterySchema.index({ userId: 1, topicKey: 1 }, { unique: true });
TopicMasterySchema.index({ topicKey: 1, masteryScore: 1 });

module.exports = mongoose.model("TopicMastery", TopicMasterySchema);
