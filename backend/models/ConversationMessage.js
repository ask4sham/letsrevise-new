/**
 * PR-019: ConversationMessage — individual turns in a tutoring conversation.
 */
const mongoose = require("mongoose");

const ConversationMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    enquiryLogId: { type: mongoose.Schema.Types.ObjectId, ref: "EnquiryLog", default: null },
  },
  { timestamps: true }
);

ConversationMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model("ConversationMessage", ConversationMessageSchema);
