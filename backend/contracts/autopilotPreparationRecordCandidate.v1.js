/**
 * Autopilot Preparation Programme — P1.1 preparation record candidate contract V1.
 * In-memory crossing proof only. Not authorization to prepare, execute, or target learners.
 */

const PREPARATION_RECORD_CANDIDATE_POLICY_VERSION = "autopilot-preparation-record-candidate-v1";

const PREPARATION_AUTHORITY_SNAPSHOT_VERSION = "autopilot-preparation-authority-snapshot-v1";

/** Matches released create validation in proposalValidation.js — not a new limit. */
const RELEASED_OBSERVATION_NOTE_MAX_LENGTH = 500;

class PreparationRecordCandidateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PreparationRecordCandidateError";
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  PREPARATION_RECORD_CANDIDATE_POLICY_VERSION,
  PREPARATION_AUTHORITY_SNAPSHOT_VERSION,
  RELEASED_OBSERVATION_NOTE_MAX_LENGTH,
  PreparationRecordCandidateError,
};
