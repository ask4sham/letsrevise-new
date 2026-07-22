/**
 * PR-PRACTICE-LOOP-1 Slice 2: Persisted practice set — student + teacher + spec + topicKeys + items.
 * Fresh V1: optional idempotencyKey (unique per student when a non-empty string) prevents duplicate set creation.
 */
const mongoose = require("mongoose");

const ITEM_CONTENT_TYPES = ["quiz_mcq", "quiz_short", "exam_question", "past_paper_question"];

function normalizeIdempotencyKey(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

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
    /**
     * Fresh-practice V1: client action key; unique with studentId when a non-empty string.
     * Blank / whitespace-only values are stored as null (not indexed by the partial unique index).
     */
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
      set: normalizeIdempotencyKey,
    },
    source: { type: String, trim: true, default: null },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lesson",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

PracticeSetSchema.index({ studentId: 1, createdAt: -1 });
PracticeSetSchema.index({ teacherId: 1, specKey: 1, createdAt: -1 });
PracticeSetSchema.index(
  { studentId: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: "studentId_1_idempotencyKey_1_partial_string",
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  }
);

module.exports = mongoose.model("PracticeSet", PracticeSetSchema);
module.exports.ITEM_CONTENT_TYPES = ITEM_CONTENT_TYPES;
module.exports.normalizeIdempotencyKey = normalizeIdempotencyKey;
