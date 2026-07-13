/**
 * Phase 4 — Critic / Examiner Check (scaffold stub).
 * Future: reject weak stems, answer-revealing images, cloned checkpoints; regenerate Phase 3 once.
 */

const { STAGE_STATUS } = require("./schemas");

/**
 * Scaffold critic: never marks stub output as publishable.
 * @param {object} staged
 */
async function runCriticBrain(staged) {
  const issues = [];
  if (staged.phase1Lesson?.status === STAGE_STATUS.STUB) {
    issues.push("phase1_not_implemented");
  }
  if (staged.phase2VisualActivities?.status === STAGE_STATUS.STUB) {
    issues.push("phase2_not_implemented");
  }
  if (staged.phase3Questions?.status === STAGE_STATUS.STUB) {
    issues.push("phase3_not_implemented");
  }
  if (!Array.isArray(staged.phase3Questions?.selfCheck) || staged.phase3Questions.selfCheck.length === 0) {
    issues.push("phase3_questions_empty");
  }

  staged.criticReport = {
    status: STAGE_STATUS.COMPLETE,
    ok: false,
    issues,
    regeneratedPhase3Once: false,
    notes: "Scaffold critic always fails closed until brains are implemented.",
  };
  staged.finalLesson = null;
  staged.saved = false;
  return staged;
}

module.exports = { runCriticBrain };
