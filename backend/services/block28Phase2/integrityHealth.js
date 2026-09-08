/**
 * Block 28 Integrity Health — machine-readable result shape for future ops endpoint.
 */
const { runBlock28IntegrityCensus } = require("./integrityCensus");

/**
 * @param {object} census - output from runBlock28IntegrityCensus
 */
function buildBlock28IntegrityHealth(census) {
  const t = census.totals || {};
  const invalid = Number(t.invalidServedQuestions || 0);
  const duplicateRisks = Number(t.conceptualDuplicateRisks || 0) + Number(t.duplicateExactIds || 0);
  const unsupported = Number(t.unsupportedAttachments || 0);
  const status =
    invalid === 0 && duplicateRisks === 0 && unsupported === 0 && Number(t.invalidLessonEdits || 0) === 0
      ? "HEALTHY"
      : invalid > 0
        ? "BLOCKED"
        : "DEGRADED";

  return {
    status,
    lessonsScanned: t.lessonsScanned || 0,
    servedQuestions: t.servedQuestions || 0,
    invalidServedQuestions: invalid,
    unsupportedAttachments: unsupported,
    duplicateRisks,
    lastScan: census.generatedAt || new Date().toISOString(),
    totals: t,
  };
}

/**
 * @param {object[]} lessons
 * @param {Map<string, object>} mastersById
 * @param {Map<string, number>} usageCount
 * @param {object} [filter]
 */
function scanBlock28IntegrityHealth(lessons, mastersById, usageCount, filter = {}) {
  const census = runBlock28IntegrityCensus(lessons, mastersById, usageCount, filter);
  return {
    census,
    health: buildBlock28IntegrityHealth(census),
  };
}

module.exports = {
  buildBlock28IntegrityHealth,
  scanBlock28IntegrityHealth,
};
