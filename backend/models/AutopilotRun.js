/**
 * Autopilot Run History — durable audit trail for autopilot runs.
 */
const mongoose = require("mongoose");

const ExecutedActionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    status: { type: String, enum: ["generated", "skipped", "failed", "planned"], required: true },
    createdCount: { type: Number, default: null },
    reason: { type: String, default: null },
    promptPackId: { type: String, default: null, trim: true },
    promptPackVersion: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const CoverageSnapshotSchema = new mongoose.Schema(
  {
    score: { type: Number, default: null },
    status: { type: String, default: null },
    counts: {
      lessons: { type: Number, default: null },
      flashcards: { type: Number, default: null },
      quizzes: { type: Number, default: null },
      examQuestions: { type: Number, default: null },
      openIssues: { type: Number, default: null },
    },
  },
  { _id: false }
);

const TopicResultSchema = new mongoose.Schema(
  {
    topicKey: { type: String, required: true },
    topicTitle: { type: String, default: null },
    requiresReview: { type: Boolean, default: null },
    plannedActions: [{ type: String }],
    executedActions: [ExecutedActionSchema],
    /** @deprecated Use coverageAfter. Kept for legacy runs. */
    updatedCoverage: {
      score: { type: Number, default: null },
      status: { type: String, default: null },
    },
    coverageBefore: { type: CoverageSnapshotSchema, default: null },
    coverageAfter: { type: CoverageSnapshotSchema, default: null },
    coverageLift: { type: Number, default: null },
  },
  { _id: false }
);

const SummarySchema = new mongoose.Schema(
  {
    generatedFlashcards: { type: Number, default: null },
    generatedQuizzes: { type: Number, default: null },
    generatedExamQuestions: { type: Number, default: null },
    skippedActions: { type: Number, default: null },
    failedActions: { type: Number, default: null },
  },
  { _id: false }
);

const AutopilotRunSchema = new mongoose.Schema(
  {
    runType: { type: String, enum: ["topic", "spec"], required: true, index: true },
    specKey: { type: String, required: true, trim: true, index: true },
    topicKey: { type: String, default: null, trim: true, index: true },
    dryRun: { type: Boolean, default: false, index: true },
    triggeredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    triggeredByRole: { type: String, default: null },
    status: { type: String, enum: ["completed", "partial", "failed"], required: true, index: true },
    minPriorityScore: { type: Number, default: null },
    limit: { type: Number, default: null },
    requestedActions: [{ type: String }],
    plannedTopicCount: { type: Number, default: null },
    executedTopicCount: { type: Number, default: null },
    skippedTopicCount: { type: Number, default: null },
    failedTopicCount: { type: Number, default: null },
    summary: { type: SummarySchema, default: null },
    topicResults: [TopicResultSchema],
    errorMessage: { type: String, default: null },
    promptPackId: { type: String, default: null, trim: true },
    promptPackVersion: { type: String, default: null, trim: true },
    experimentId: { type: String, default: null, trim: true, index: true },
    safeModeActivated: { type: Boolean, default: false },
    safeModeEvidenceSample: {
      autopilotRuns: { type: Number, default: null },
      reviewedItems: { type: Number, default: null },
      quizAttempts: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

AutopilotRunSchema.index({ specKey: 1, createdAt: -1 });
AutopilotRunSchema.index({ topicKey: 1, createdAt: -1 });
AutopilotRunSchema.index({ triggeredByUserId: 1, createdAt: -1 });
AutopilotRunSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("AutopilotRun", AutopilotRunSchema);
