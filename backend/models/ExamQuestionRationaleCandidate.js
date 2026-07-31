/**
 * V2.3A ExamQuestion rationale candidate — review-only persistence.
 * Never writes to ExamQuestion. Approval belongs to V2.3C.
 */
const mongoose = require("mongoose");

const MAX_TEXT = 8000;
const MAX_EXPLANATION = 1000;
const MAX_OPTION = 2000;
const MAX_OPTIONS = 12;
const MAX_MARK_SCHEME_LINES = 40;
const MAX_MARK_SCHEME_LINE = 2000;
const MAX_IDEMPOTENCY_KEY = 128;
const MAX_ISSUE_CODES = 40;

const SourceSnapshotSchema = new mongoose.Schema(
  {
    subject: { type: String, trim: true, maxlength: 200, default: "" },
    examBoard: { type: String, trim: true, maxlength: 200, default: "" },
    level: { type: String, trim: true, maxlength: 200, default: "" },
    tier: { type: String, trim: true, maxlength: 100, default: "" },
    topic: { type: String, trim: true, maxlength: 500, default: "" },
    topicKey: { type: String, trim: true, maxlength: 500, default: "" },
    questionStatus: { type: String, trim: true, maxlength: 40, default: "" },
    sharedStem: { type: String, trim: true, maxlength: MAX_TEXT, default: "" },
    questionText: { type: String, trim: true, maxlength: MAX_TEXT, default: "" },
    options: {
      type: [
        {
          type: String,
          maxlength: MAX_OPTION,
        },
      ],
      default: [],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length <= MAX_OPTIONS;
        },
        message: "options exceed max count",
      },
    },
    correctIndex: { type: Number, default: null },
    correctOption: { type: String, trim: true, maxlength: MAX_OPTION, default: "" },
    marks: { type: Number, default: null },
    markScheme: {
      type: [
        {
          type: String,
          maxlength: MAX_MARK_SCHEME_LINE,
        },
      ],
      default: [],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length <= MAX_MARK_SCHEME_LINES;
        },
        message: "markScheme exceed max count",
      },
    },
    imageContextText: { type: String, trim: true, maxlength: MAX_TEXT, default: "" },
    currentExplanation: { type: String, trim: true, maxlength: MAX_EXPLANATION, default: "" },
  },
  { _id: false, strict: true }
);

const ExamQuestionRationaleCandidateSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamQuestion",
      required: true,
      index: true,
    },
    partLabel: { type: String, required: true, trim: true, maxlength: 32 },
    sourceFingerprint: { type: String, required: true, trim: true, maxlength: 64 },
    sourceUpdatedAt: { type: Date, default: null },
    sourceSnapshot: { type: SourceSnapshotSchema, required: true },
    priorExplanation: { type: String, trim: true, maxlength: MAX_EXPLANATION, default: "" },
    explanation: { type: String, trim: true, maxlength: MAX_EXPLANATION, default: "" },
    status: {
      type: String,
      required: true,
      enum: ["generating", "pending", "failed", "approved", "rejected", "superseded", "stale"],
      index: true,
    },
    /** True only for generating/pending — drives unique active-source index. */
    active: { type: Boolean, required: true, default: false, index: true },
    attemptNumber: { type: Number, required: true, min: 1, max: 2, default: 1 },
    generationGroupKey: { type: String, required: true, trim: true, maxlength: 300 },
    idempotencyKey: { type: String, required: true, trim: true, maxlength: MAX_IDEMPOTENCY_KEY },
    promptVersion: { type: String, trim: true, maxlength: 64, default: "" },
    model: { type: String, trim: true, maxlength: 128, default: "" },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    generatedAt: { type: Date, required: true, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    /** Private lease token for the owning generation request — never accept from client / never expose in DTO. */
    generationLeaseToken: { type: String, trim: true, maxlength: 80, default: "" },
    /** Absolute expiry for generating reservations; lazy stale recovery uses this. */
    generationLeaseExpiresAt: { type: Date, default: null },
    failureCode: { type: String, trim: true, maxlength: 80, default: "" },
    validationIssueCodes: {
      type: [
        {
          type: String,
          maxlength: 80,
        },
      ],
      default: [],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length <= MAX_ISSUE_CODES;
        },
        message: "validationIssueCodes exceed max count",
      },
    },
    /** V2.3B2b1 rejection audit — set only by atomic reject path. */
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: { type: Date, default: null },
    rejectionReasonCode: { type: String, trim: true, maxlength: 40, default: "" },
    rejectionNote: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { timestamps: true, strict: true }
);

ExamQuestionRationaleCandidateSchema.index(
  { generatedBy: 1, idempotencyKey: 1 },
  { unique: true, name: "uq_actor_idempotency" }
);

ExamQuestionRationaleCandidateSchema.index(
  { questionId: 1, partLabel: 1, sourceFingerprint: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: "uq_active_source_candidate",
  }
);

ExamQuestionRationaleCandidateSchema.index(
  { questionId: 1, partLabel: 1, generatedAt: -1 },
  { name: "ix_review_lookup" }
);

ExamQuestionRationaleCandidateSchema.index(
  { status: 1, generatedAt: -1 },
  { name: "ix_status_queue" }
);

ExamQuestionRationaleCandidateSchema.index(
  { status: 1, active: 1, generationLeaseExpiresAt: 1 },
  { name: "ix_stale_generating_lookup" }
);

module.exports =
  mongoose.models.ExamQuestionRationaleCandidate ||
  mongoose.model("ExamQuestionRationaleCandidate", ExamQuestionRationaleCandidateSchema);
