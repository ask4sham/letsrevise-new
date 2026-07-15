/**
 * Phase 4 — Critic / Examiner Check + assembly gate (PR A).
 *
 * ok=true when Phase 1–3 + assembled finalLesson pass validation.
 * DB persistence is still intentionally disabled (persistenceReady=false).
 */

const { STAGE_STATUS } = require("./schemas");

/**
 * @param {object} staged
 * @param {{ assemblyOk?: boolean, finalValidationOk?: boolean, assemblyIssues?: string[] }} [assembly]
 */
async function runCriticBrain(staged, assembly = {}) {
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

  const assemblyOk = assembly.assemblyOk === true && staged.finalLesson && typeof staged.finalLesson === "object";
  const finalValidationOk = assembly.finalValidationOk === true;
  if (!assemblyOk) {
    issues.push("assembly_failed");
    for (const i of assembly.assemblyIssues || []) issues.push(`assembly:${i}`);
  }
  if (assemblyOk && !finalValidationOk) {
    issues.push("final_validation_failed");
    for (const i of assembly.assemblyIssues || []) issues.push(`final:${i}`);
  }

  // PR A: content/assembly may pass, but Mongo persistence is not implemented yet.
  issues.push("db_persistence_not_implemented");

  const contentReady =
    staged.phase1Lesson?.status === STAGE_STATUS.COMPLETE &&
    staged.phase2VisualActivities?.status === STAGE_STATUS.COMPLETE &&
    phase3QualityOk &&
    staged.phase2VisualActivities?.studentSafe === true;

  const ok = Boolean(contentReady && assemblyOk && finalValidationOk);

  if (staged.finalLesson && typeof staged.finalLesson === "object") {
    staged.finalLesson.metadata = {
      ...(staged.finalLesson.metadata || {}),
      v2CriticSnapshot: {
        ok,
        contentReady,
        assemblyOk,
        finalValidationOk,
        persistenceReady: false,
        issues: [...issues],
      },
      persistence: {
        implemented: false,
        saved: false,
      },
    };
  }

  staged.criticReport = {
    status: STAGE_STATUS.COMPLETE,
    ok,
    contentReady: Boolean(contentReady),
    phase3QualityOk: Boolean(phase3QualityOk),
    assemblyOk: Boolean(assemblyOk),
    finalValidationOk: Boolean(finalValidationOk),
    persistenceReady: false,
    saveReady: false,
    issues,
    regeneratedPhase3Once: false,
    notes: ok
      ? "Phase 1–3 + finalLesson assembly/validation passed. Critic ok=true for content, but DB persistence is not implemented in PR A (saved remains false)."
      : "Critic fail-closed: incomplete phases, assembly/validation issues, and/or persistence disabled.",
  };

  // Never save in PR A.
  staged.saved = false;
  if (!ok) {
    staged.finalLesson = null;
  }
  return staged;
}

module.exports = { runCriticBrain };
