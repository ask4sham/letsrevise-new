/**
 * Phase 4 — Critic / Examiner Check.
 * Phase 1–2 may be complete; Phase 3 remains stub → overall critic still fails closed (no save).
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
  if (staged.phase2VisualActivities?.status !== STAGE_STATUS.COMPLETE) {
    issues.push(
      staged.phase2VisualActivities?.status === STAGE_STATUS.STUB
        ? "phase2_not_implemented"
        : "phase2_incomplete"
    );
  }
  if (staged.phase3Questions?.status === STAGE_STATUS.STUB) {
    issues.push("phase3_not_implemented");
  }
  if (!Array.isArray(staged.phase3Questions?.selfCheck) || staged.phase3Questions.selfCheck.length === 0) {
    issues.push("phase3_questions_empty");
  }

  // Surface Phase 2 safety flag into overall critic notes if present.
  if (staged.phase2VisualActivities?.studentSafe !== true) {
    issues.push("phase2_student_safety_failed");
  }

  staged.criticReport = {
    status: STAGE_STATUS.COMPLETE,
    ok: false,
    issues,
    regeneratedPhase3Once: false,
    notes:
      "Overall critic fails closed until Question Brain is implemented. Phase 1–2 may already be complete; retrieval images must remain student-safe.",
  };
  staged.finalLesson = null;
  staged.saved = false;
  return staged;
}

module.exports = { runCriticBrain };
