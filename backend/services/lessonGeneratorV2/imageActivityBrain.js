/**
 * Phase 2 — Image / Activity Brain (scaffold stub).
 * Future: analyse Phase 1; teaching diagrams may label; retrieval images must NOT reveal answers.
 */

const { STAGE_STATUS } = require("./schemas");

/**
 * @param {{ topic: string }} ctx
 * @param {object} staged
 */
async function runImageActivityBrain(ctx, staged) {
  staged.phase2VisualActivities = {
    ...staged.phase2VisualActivities,
    status: STAGE_STATUS.STUB,
    teachingDiagrams: [],
    retrievalActivities: [],
    studentSafe: true,
    notes:
      "Scaffold only. Will create diagram/activity briefs from Phase 1. Retrieval/activity images must not give away answers.",
    topic: ctx.topic,
  };
  return staged;
}

module.exports = { runImageActivityBrain };
