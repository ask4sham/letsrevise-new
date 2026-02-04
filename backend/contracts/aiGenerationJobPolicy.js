// AI generation job lifecycle and access policy (pure data contract only)

// 1) Ownership rules (documentation-only)
const OWNERSHIP_RULES = {
  // Field on the job payload that identifies the creator/owner
  ownerField: "requestedByUserId",

  // Teachers may be allowed (by future routes) to create jobs on behalf of a class
  teacherCanCreateForClass: true,

  // Admins are allowed to bypass ownership checks for debugging / operations
  adminBypass: true,
};

// 2) Visibility rules (documentation-only)
// These describe who SHOULD be able to read a given job,
// actual enforcement will live in routes/controllers.
const VISIBILITY_RULES = {
  OWNER_ONLY: "OWNER_ONLY", // student/parent created jobs
  TEACHER_OR_OWNER: "TEACHER_OR_OWNER", // e.g. teacher-initiated jobs tied to a class
  ADMIN_ALL: "ADMIN_ALL", // admins can inspect any job
};

// 3) Status transition rules (documentation-only)
// Maps a given status to the set of statuses it is allowed to transition to.
const STATUS_TRANSITIONS = {
  QUEUED: ["RUNNING", "CANCELLED"],
  RUNNING: ["SUCCEEDED", "FAILED", "CANCELLED"],
  FAILED: [], // terminal
  SUCCEEDED: [], // terminal
  CANCELLED: [], // terminal
};

// 4) Terminal statuses + retry policy (documentation-only)
const TERMINAL_STATUSES = ["SUCCEEDED", "FAILED", "CANCELLED"];

const RETRY_POLICY = {
  // Only FAILED jobs are considered retryable by default
  retryableStatuses: ["FAILED"],

  // Default maximum number of retries; actual enforcement will be done by workers
  maxRetriesDefault: 1,
};

module.exports = {
  OWNERSHIP_RULES,
  VISIBILITY_RULES,
  STATUS_TRANSITIONS,
  TERMINAL_STATUSES,
  RETRY_POLICY,
};

