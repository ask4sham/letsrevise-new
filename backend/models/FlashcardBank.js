/**
 * PR-F1: Flashcard Bank — one doc per (ownerId, topicKey) with cards array.
 * Used for bulk import per topic and copy-to-lesson.
 */
const mongoose = require("mongoose");

const BankCardSchema = new mongoose.Schema(
  {
    front: { type: String, required: true, trim: true },
    back: { type: String, required: true, trim: true },
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const FlashcardBankSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, trim: true, default: "Biology" },
    examBoard: { type: String, trim: true, default: "AQA" },
    level: { type: String, trim: true, default: "GCSE" },
    topicKey: { type: String, required: true, trim: true, index: true },
    topicName: { type: String, trim: true, default: "" },
    cards: { type: [BankCardSchema], default: [] },
  },
  { timestamps: true }
);

FlashcardBankSchema.index({ ownerId: 1, topicKey: 1 }, { unique: true });

module.exports = mongoose.model("FlashcardBank", FlashcardBankSchema);
