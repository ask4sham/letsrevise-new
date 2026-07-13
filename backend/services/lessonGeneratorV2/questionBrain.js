/**
 * Phase 3 — Question Brain (scaffold stub).
 * Future: analyse Phase 1 + Phase 2; write SC×3, CP×3, quiz×5 with varied skills.
 * Must NOT rely on V1 repair templates as the primary writer.
 */

const { STAGE_STATUS } = require("./schemas");

/**
 * @param {{ topic: string }} ctx
 * @param {object} staged
 */
async function runQuestionBrain(ctx, staged) {
  staged.phase3Questions = {
    ...staged.phase3Questions,
    status: STAGE_STATUS.STUB,
    selfCheck: [],
    checkpoint: [],
    quiz: [],
    rules: {
      selfCheckCount: 3,
      checkpointCount: 3,
      quizCount: 5,
    },
    notes:
      "Scaffold only. Will generate topic-specific varied questions from Phase 1+2. Fail closed — no generic template padding.",
    topic: ctx.topic,
  };
  return staged;
}

module.exports = { runQuestionBrain };
