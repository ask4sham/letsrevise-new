/**
 * PR-F1: Topic-level Flashcard Bank (teacher-owned, per topicKey).
 * Used to seed lesson.flashcards when creating/editing lessons.
 */
const mongoose = require("mongoose");

const TopicFlashcardSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, trim: true, default: "Biology" },
    examBoard: { type: String, trim: true, default: "AQA" },
    level: { type: String, trim: true, default: "GCSE" },
    topicKey: { type: String, required: true, trim: true, index: true },
    topic: { type: String, trim: true, default: "" },
    front: { type: String, required: true, trim: true, maxlength: 500 },
    back: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    fingerprint: { type: String, required: true, index: true },
    assets: [
      {
        type: { type: String, default: "image" },
        mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
        url: { type: String, default: null },
        alt: { type: String, default: null },
      },
    ],
    isArchived: { type: Boolean, default: false },
    /** PR-014.1: generatedFrom { jobId, statementCodes, seed } for publish gate */
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

TopicFlashcardSchema.index({ ownerId: 1, topicKey: 1, status: 1 });
TopicFlashcardSchema.index({ topicKey: 1, status: 1 });
TopicFlashcardSchema.index({ ownerId: 1, topicKey: 1, fingerprint: 1 }, { unique: true });

module.exports = mongoose.model("TopicFlashcard", TopicFlashcardSchema);
