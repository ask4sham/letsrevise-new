/**
 * Content Graph Layer — ContentNode model.
 * Represents a taxonomy entity or content item in the canonical graph.
 *
 * Index notes:
 * - canonicalKey: sparse unique — excludes null/undefined; canonicalKey is required so never null.
 * - In production, indexes are created automatically on first use. For large datasets,
 *   consider running db.contentnodes.createIndex() once before backfill if needed.
 */
const mongoose = require("mongoose");

const NODE_TYPES = [
  "subject",
  "spec",
  "mainTopic",
  "subTopic",
  "lesson",
  "flashcard",
  "quizQuestion",
  "examQuestion",
  "revisionDraft",
];

const ContentNodeSchema = new mongoose.Schema(
  {
    nodeType: { type: String, enum: NODE_TYPES, required: true, index: true },
    title: { type: String, trim: true, default: "" },
    slug: { type: String, trim: true, default: "" },
    subject: { type: String, trim: true, default: null },
    specKey: { type: String, trim: true, default: null, index: true },
    topicKey: { type: String, trim: true, default: null, index: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null, index: true },
    flashcardId: { type: mongoose.Schema.Types.ObjectId, ref: "TopicFlashcard", default: null, index: true },
    quizQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: "TopicQuizQuestion", default: null, index: true },
    examQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamQuestion", default: null, index: true },
    revisionDraftId: { type: mongoose.Schema.Types.ObjectId, ref: "LessonRevisionDraft", default: null, index: true },
    canonicalKey: { type: String, required: true, trim: true, index: true },
    legacyKeys: [{ type: String, trim: true }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: "active", index: true },
  },
  { timestamps: true }
);

ContentNodeSchema.index({ nodeType: 1, specKey: 1, topicKey: 1 });
// Sparse unique: excludes docs without canonicalKey; with required: true we never have null.
// Empty string would be indexed; our canonicalKey helpers never return "" for persisted nodes.
ContentNodeSchema.index({ canonicalKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("ContentNode", ContentNodeSchema);
module.exports.NODE_TYPES = NODE_TYPES;
