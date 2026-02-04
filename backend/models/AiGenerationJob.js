const mongoose = require("mongoose");

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;
const Mixed = Schema.Types.Mixed;

const AiGenerationJobSchema = new Schema(
  {
    // Contract/versioning
    version: { type: Number, required: true, default: 1 },

    // Job type (e.g., LESSON_DRAFT, QUIZ_DRAFT, ASSESSMENT_PAPER_DRAFT)
    type: { type: String, required: true, trim: true },

    // Ownership
    requestedByUserId: {
      type: ObjectId,
      ref: "User",
      required: true,
    },

    // Optional linkage to planning/lesson entities
    curriculumId: {
      type: ObjectId,
      ref: "Curriculum",
      default: null,
    },
    lessonId: {
      type: ObjectId,
      ref: "Lesson",
      default: null,
    },

    // Job lifecycle status (e.g., QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED)
    status: {
      type: String,
      required: true,
      default: "QUEUED",
      trim: true,
    },

    // Free-form input payload used to drive generation
    input: {
      type: Mixed,
      required: true,
    },

    // Generation output (nullable until job completes)
    output: {
      type: Mixed,
      default: null,
    },

    // Error information when a job fails (nullable)
    error: {
      code: { type: String, default: null },
      message: { type: String, default: null },
      details: { type: Mixed, default: null },
    },

    // Explicit lifecycle timestamps (in addition to createdAt/updatedAt)
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for common access patterns
AiGenerationJobSchema.index({ requestedByUserId: 1, createdAt: -1 });
AiGenerationJobSchema.index({ status: 1, createdAt: -1 });
AiGenerationJobSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("AiGenerationJob", AiGenerationJobSchema);

