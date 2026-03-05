/**
 * PR-019: Conversation — threaded tutoring chat container.
 */
const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    role: { type: String, enum: ["student", "teacher", "admin"], required: true },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, trim: true, default: null, index: true },
    lessonId: { type: mongoose.Schema.Types.Mixed, default: null },
    title: { type: String, trim: true, default: "" },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });
ConversationSchema.index({ userId: 1, lastMessageAt: -1 });
ConversationSchema.index({ specKey: 1, topicKey: 1, updatedAt: -1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
