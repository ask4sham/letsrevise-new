/**
 * Autopilot Preparation Programme — P1.2 gated preparation record persistence contract V1.
 * Durable crossing record only. Not authorization to prepare content, target learners, or execute.
 */

const PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION =
  "autopilot-preparation-record-persistence-v1";

const PREPARATION_RECORD_EVENT_CREATED = "PREPARATION_RECORD_CREATED";

const PREPARATION_RECORD_ACTIVE_EVENT_TYPES = Object.freeze([
  PREPARATION_RECORD_EVENT_CREATED,
]);

class PreparationRecordPersistenceError extends Error {
  constructor(code, message, statusCode = 500, details = {}) {
    super(message);
    this.name = "PreparationRecordPersistenceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = {
  PREPARATION_RECORD_PERSISTENCE_POLICY_VERSION,
  PREPARATION_RECORD_EVENT_CREATED,
  PREPARATION_RECORD_ACTIVE_EVENT_TYPES,
  PreparationRecordPersistenceError,
};
