/**
 * Phase 1 — Lesson Brain (scaffold stub).
 * Future: reuse strongest V1 lesson-writing prompts/constants; no final questions.
 */

const { STAGE_STATUS } = require("./schemas");

/**
 * @param {{ topic: string, subject: string, level: string, board?: string, topicKey?: string }} ctx
 * @param {object} staged
 */
async function runLessonBrain(ctx, staged) {
  staged.phase1Lesson = {
    ...staged.phase1Lesson,
    status: STAGE_STATUS.STUB,
    teachingBlocks: [],
    placeholders: [
      "SELF_CHECK_PLACEHOLDER",
      "CHECKPOINT_PLACEHOLDER",
      "QUIZ_PLACEHOLDER",
      "IMAGE_ACTIVITY_PLACEHOLDER",
    ],
    notes:
      "Scaffold only. Will write teaching content (objectives, explanations, misconceptions, exam tips) without finalising questions.",
    topic: ctx.topic,
  };
  return staged;
}

module.exports = { runLessonBrain };
