// AI generation job contract (shape + enums + version only; no runtime behavior)

// 1) Version number for the job payload contract
const AI_GENERATION_JOB_VERSION = 1;

// 2) Allowed job types (enum-like)
const JOB_TYPES = {
  LESSON_DRAFT: "LESSON_DRAFT",
  QUIZ_DRAFT: "QUIZ_DRAFT",
  ASSESSMENT_PAPER_DRAFT: "ASSESSMENT_PAPER_DRAFT",
};

// 3) Allowed job statuses (enum-like)
const JOB_STATUSES = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

// 4) Canonical payload shape (documentation-only example, not used at runtime)
const JOB_PAYLOAD_EXAMPLE = {
  version: AI_GENERATION_JOB_VERSION,
  type: JOB_TYPES.LESSON_DRAFT,

  // Who requested this job
  requestedByUserId: "64f0c8a9f1b2c30012ab3456", // Mongo ObjectId as string

  // Optional linkage to higher-level planning objects
  curriculumId: "64f0c8a9f1b2c30012ab3457", // optional
  lessonId: "64f0c8a9f1b2c30012ab3458", // optional

  // Free-form input parameters for the AI generation
  input: {
    subject: "Biology",
    level: "GCSE",
    topic: "Photosynthesis",
    // ...any other generation parameters
  },

  // Output from the AI generation (null until job has produced something)
  output: null,

  // Current status of the job
  status: JOB_STATUSES.QUEUED,

  // Error details when status === FAILED (otherwise null)
  error: null,

  // Timestamps (ISO strings recommended when persisted)
  timestamps: {
    createdAt: "2025-01-01T10:00:00.000Z",
    startedAt: null,
    finishedAt: null,
  },
};

module.exports = {
  AI_GENERATION_JOB_VERSION,
  JOB_TYPES,
  JOB_STATUSES,
  JOB_PAYLOAD_EXAMPLE,
};

