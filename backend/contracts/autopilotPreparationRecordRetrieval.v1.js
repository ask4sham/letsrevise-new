/**
 * Autopilot Preparation Programme — P1.3 gated preparation record retrieval contract V1.
 * Read-only durable record access only. Not authorization to prepare content, target learners, or execute.
 */

const PREPARATION_RECORD_RETRIEVAL_POLICY_VERSION =
  "autopilot-preparation-record-retrieval-v1";

class PreparationRecordRetrievalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PreparationRecordRetrievalError";
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  PREPARATION_RECORD_RETRIEVAL_POLICY_VERSION,
  PreparationRecordRetrievalError,
};
