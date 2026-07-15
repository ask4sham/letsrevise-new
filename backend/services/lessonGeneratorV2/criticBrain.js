/**
 * Phase 4 — Critic / Examiner Check.
 *
 * Phase 1–3 content quality is checked here. Final lesson persistence remains
 * disabled in this PR — critic reports Phase 3 clearly but never saves.
 */

const { STAGE_STATUS } = require("./schemas");

/**
 * @param {object} staged
 */
async function runCriticBrain(staged) {
  const issues = [];
  const phase3 = staged.phase3Questions || {};

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

  let phase3QualityOk = false;
  if (phase3.status === STAGE_STATUS.STUB) {
    issues.push("phase3_not_implemented");
  } else if (phase3.status !== STAGE_STATUS.COMPLETE) {
    issues.push("phase3_incomplete");
  } else {
    const sc = Array.isArray(phase3.selfCheck) ? phase3.selfCheck.length : 0;
    const cp = Array.isArray(phase3.checkpoint) ? phase3.checkpoint.length : 0;
    const qz = Array.isArray(phase3.quiz) ? phase3.quiz.length : 0;
    if (sc !== 3) issues.push("phase3_selfCheck_count");
    if (cp !== 3) issues.push("phase3_checkpoint_count");
    if (qz !== 5) issues.push("phase3_quiz_count");
    if (sc === 0 && cp === 0 && qz === 0) issues.push("phase3_questions_empty");

    const purposes = [...(phase3.selfCheck || []), ...(phase3.checkpoint || []), ...(phase3.quiz || [])]
      .map((q) => String(q?.purpose || "").toLowerCase())
      .filter(Boolean);
    if (purposes.length && new Set(purposes).size < 4) {
      issues.push("phase3_purpose_variety_low");
    }

    const phase3IssueCodes = new Set([
      "phase3_incomplete",
      "phase3_not_implemented",
      "phase3_questions_empty",
      "phase3_selfCheck_count",
      "phase3_checkpoint_count",
      "phase3_quiz_count",
      "phase3_purpose_variety_low",
    ]);
    phase3QualityOk = sc === 3 && cp === 3 && qz === 5 && !issues.some((i) => phase3IssueCodes.has(i));
  }

  if (staged.phase2VisualActivities?.studentSafe !== true) {
    issues.push("phase2_student_safety_failed");
  }

  // Persistence is intentionally not enabled yet.
  issues.push("final_lesson_persistence_not_ready");

  const contentReady =
    staged.phase1Lesson?.status === STAGE_STATUS.COMPLETE &&
    staged.phase2VisualActivities?.status === STAGE_STATUS.COMPLETE &&
    phase3QualityOk &&
    staged.phase2VisualActivities?.studentSafe === true;

  staged.criticReport = {
    status: STAGE_STATUS.COMPLETE,
    // Content may be ready, but overall ok stays false until persistence is designed.
    ok: false,
    contentReady: Boolean(contentReady),
    phase3QualityOk: Boolean(phase3QualityOk),
    issues,
    regeneratedPhase3Once: false,
    notes: contentReady
      ? "Phase 1–3 content quality passed (including Question Brain). Critic still blocks save because final lesson persistence is not enabled yet."
      : "Critic fail-closed: incomplete phases, Phase 3 quality issues, and/or persistence disabled. Retrieval images must remain student-safe.",
  };
  staged.finalLesson = null;
  staged.saved = false;
  return staged;
}

module.exports = { runCriticBrain };
