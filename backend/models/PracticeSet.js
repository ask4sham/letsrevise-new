/**
 * PR-PRACTICE-LOOP-1 Slice 2: Persisted practice set — student + teacher + spec + topicKeys + items.
 * Attempts can reference practiceSetId later; items are content references only (no answers).
 */
const mongoose = require("mongoose");

const ITEM_CONTENT_TYPES = ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"];

const PracticeSetItemSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      required: true,
      enum: ITEM_CONTENT_TYPES,
    },
    contentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    topicKey: { type: String, required: true, trim: true },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const PracticeSetSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKeys: [{ type: String, trim: true }],
    items: [PracticeSetItemSchema],
  },
  { timestamps: true }
);

PracticeSetSchema.index({ studentId: 1, createdAt: -1 });
PracticeSetSchema.index({ teacherId: 1, specKey: 1, createdAt: -1 });

module.exports = mongoose.model("PracticeSet", PracticeSetSchema);
module.exports.ITEM_CONTENT_TYPES = ITEM_CONTENT_TYPES;
