/**
 * Autopilot Preparation Programme — P1.5 gated preparation record list contract V1.
 * Read-only bounded collection access only. Not authorization to prepare content, target learners, or execute.
 */

const PREPARATION_RECORD_LIST_POLICY_VERSION = "autopilot-preparation-record-list-v1";

class PreparationRecordListError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PreparationRecordListError";
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  PREPARATION_RECORD_LIST_POLICY_VERSION,
  PreparationRecordListError,
};
