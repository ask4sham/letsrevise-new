/**
 * Phase 4 — Critic / Examiner Check.
 * Phase 1 may be complete; Phase 2–3 remain stubs → overall critic still fails closed (no save).
 */

const { STAGE_STATUS } = require("./schemas");

/**
 * @param {object} staged
 */
async function runCriticBrain(staged) {
  const issues = [];

  if (staged.phase1Lesson?.status !== STAGE_STATUS.COMPLETE) {
    issues.push(
      staged.phase1Lesson?.status === STAGE_STATUS.STUB
        ? "phase1_not_implemented"
        : "phase1_incomplete"
    );
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
    notes:
      "Overall critic fails closed until Image Brain and Question Brain are implemented. Phase 1 may already be complete.",
  };
  staged.finalLesson = null;
  staged.saved = false;
  return staged;
}

module.exports = { runCriticBrain };
