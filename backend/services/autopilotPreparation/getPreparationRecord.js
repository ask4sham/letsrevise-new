/**
 * Autopilot Preparation Programme — P1.3 gated preparation record retrieval service.
 * Service-only. No API routes. No proposal read. No mutation. No execution.
 */
const { isPreparationRecordRetrievalEnabled } = require("../../config/autopilotPreparationRuntime");
const { PreparationRecordRetrievalError } = require("../../contracts/autopilotPreparationRecordRetrieval.v1");
const AutopilotPreparationRecord = require("../../models/AutopilotPreparationRecord");

async function getPreparationRecord(actionId) {
  if (!isPreparationRecordRetrievalEnabled()) {
    throw new PreparationRecordRetrievalError(
      "PREPARATION_RECORD_RETRIEVAL_DISABLED",
      "Autopilot preparation record retrieval is disabled"
    );
  }

  const normalizedActionId = String(actionId).trim();
  if (!normalizedActionId) {
    throw new PreparationRecordRetrievalError(
      "INVALID_RETRIEVAL_REQUEST",
      "actionId is required for preparation record retrieval",
      { actionId }
    );
  }

  const record = await AutopilotPreparationRecord.findOne({ actionId: normalizedActionId }).lean();
  if (!record) {
    throw new PreparationRecordRetrievalError(
      "PREPARATION_RECORD_NOT_FOUND",
      "Preparation record not found",
      { actionId: normalizedActionId }
    );
  }

  return record;
}

module.exports = {
  getPreparationRecord,
  PreparationRecordRetrievalError,
};
