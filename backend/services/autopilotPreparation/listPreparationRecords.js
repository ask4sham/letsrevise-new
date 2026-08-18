/**
 * Autopilot Preparation Programme — P1.5 gated preparation record list service.
 * Service-only bounded read. No API routes. No proposal read. No mutation. No execution.
 */
const { isPreparationRecordRetrievalEnabled } = require("../../config/autopilotPreparationRuntime");
const { PreparationRecordListError } = require("../../contracts/autopilotPreparationRecordList.v1");
const AutopilotPreparationRecord = require("../../models/AutopilotPreparationRecord");

function parseListQuery(query = {}) {
  const rawLimit = query.limit;
  const rawOffset = query.offset;

  if (rawLimit !== undefined && rawLimit !== null && String(rawLimit).trim() !== "") {
    const parsedLimit = parseInt(String(rawLimit), 10);
    if (Number.isNaN(parsedLimit)) {
      throw new PreparationRecordListError(
        "INVALID_LIST_REQUEST",
        "limit must be a positive integer",
        { limit: rawLimit }
      );
    }
  }

  if (rawOffset !== undefined && rawOffset !== null && String(rawOffset).trim() !== "") {
    const parsedOffset = parseInt(String(rawOffset), 10);
    if (Number.isNaN(parsedOffset)) {
      throw new PreparationRecordListError(
        "INVALID_LIST_REQUEST",
        "offset must be a non-negative integer",
        { offset: rawOffset }
      );
    }
  }

  const limit = Math.min(Math.max(parseInt(String(query.limit || "20"), 10) || 20, 1), 50);
  const offset = Math.max(parseInt(String(query.offset || "0"), 10) || 0, 0);
  return { limit, offset };
}

async function listPreparationRecords(query = {}) {
  if (!isPreparationRecordRetrievalEnabled()) {
    throw new PreparationRecordListError(
      "PREPARATION_RECORD_RETRIEVAL_DISABLED",
      "Autopilot preparation record retrieval is disabled"
    );
  }

  const { limit, offset } = parseListQuery(query);

  const [records, total] = await Promise.all([
    AutopilotPreparationRecord.find({})
      .sort({ createdAt: -1, actionId: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    AutopilotPreparationRecord.countDocuments({}),
  ]);

  return {
    records,
    pagination: { limit, offset, total },
  };
}

module.exports = {
  listPreparationRecords,
  parseListQuery,
  PreparationRecordListError,
};
