/**
 * PR-014: Track content generation jobs (starter pack etc).
 */
const mongoose = require("mongoose");

const ContentGenerationJobSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, trim: true, default: "" },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, required: true, trim: true, index: true },
    statementCodes: { type: [String], default: [] },
    tier: { type: String, trim: true, default: null },
    mode: {
      type: String,
      enum: ["starterPack"],
      default: "starterPack",
    },
    status: {
      type: String,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },
    seed: { type: String, required: true, trim: true },
    inputs: {
      statements: { type: [mongoose.Schema.Types.Mixed], default: [] },
      retrievedDocs: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    outputs: {
      lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", default: null },
      flashcardIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      quizQuestionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
      examQuestionIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    },
    errors: { type: [String], default: [] },
  },
  { timestamps: true }
);

ContentGenerationJobSchema.index({ specKey: 1, topicKey: 1, createdAt: -1 });

module.exports = mongoose.model("ContentGenerationJob", ContentGenerationJobSchema);
