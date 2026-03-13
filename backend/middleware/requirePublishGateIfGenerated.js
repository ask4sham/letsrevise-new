/**
 * PR-014.1b: Hard gate — block publish of generated content if job has blocking issues.
 * Only applies when entity has metadata.generatedFrom.jobId.
 */
const { validateStarterPackPublishability } = require("../services/publishGate/validatePublishableContent");

/**
 * Check if generated content can be published. Call before publishing.
 * @param {Object} entity - Doc with optional metadata.generatedFrom.jobId
 * @param {Object} user - req.user
 * @returns {Promise<{ ok: boolean, issues?: Array, blocks?: number }>}
 */
async function checkPublishGateForGenerated(entity, user) {
  const jobId = entity?.metadata?.generatedFrom?.jobId;
  if (!jobId || !user) return { ok: true };

  const check = await validateStarterPackPublishability({ jobId: String(jobId), user });
  if (check.blocks > 0) {
    return { ok: false, issues: check.issues, blocks: check.blocks, summaryByType: check.summaryByType };
  }
  return { ok: true };
}

module.exports = { checkPublishGateForGenerated };
