/**
 * Phase 2 Image / Activity Brain quality gate + student-safety critic.
 */

const { STAGE_STATUS } = require("./schemas");
const { findRevealLeaks, studentImageRevealsAnswer } = require("./studentImageSafety");

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

/**
 * @param {object} phase2
 * @param {{ phase1?: object }} [ctx]
 * @returns {{ ok: boolean, issues: string[] }}
 */
function validatePhase2VisualActivities(phase2, ctx = {}) {
  const issues = [];
  if (!phase2 || typeof phase2 !== "object") {
    return { ok: false, issues: ["phase2_missing"] };
  }

  if (phase2.status !== STAGE_STATUS.COMPLETE) {
    issues.push(`phase2_status_not_complete:${phase2.status || "missing"}`);
  }

  const teaching = Array.isArray(phase2.teachingDiagrams) ? phase2.teachingDiagrams : [];
  const retrieval = Array.isArray(phase2.retrievalActivities) ? phase2.retrievalActivities : [];

  if (teaching.length < 1) issues.push("phase2_teaching_diagrams_missing");
  if (retrieval.length < 1) issues.push("phase2_retrieval_activities_missing");

  teaching.forEach((d, i) => {
    if (!d || typeof d !== "object") {
      issues.push(`phase2_teaching_${i}_invalid`);
      return;
    }
    if (d.purpose && d.purpose !== "teaching") {
      issues.push(`phase2_teaching_${i}_wrong_purpose`);
    }
    if (!nonEmpty(d.title, 3)) issues.push(`phase2_teaching_${i}_title_weak`);
    if (!nonEmpty(d.prompt, 30)) issues.push(`phase2_teaching_${i}_prompt_weak`);
    if (!Array.isArray(d.whatToNotice) || d.whatToNotice.filter((w) => nonEmpty(w, 8)).length < 1) {
      issues.push(`phase2_teaching_${i}_whatToNotice_missing`);
    }
    // Teaching diagrams MAY label — no reveal ban here.
  });

  retrieval.forEach((a, i) => {
    if (!a || typeof a !== "object") {
      issues.push(`phase2_retrieval_${i}_invalid`);
      return;
    }
    if (a.purpose && a.purpose !== "retrieval") {
      issues.push(`phase2_retrieval_${i}_wrong_purpose`);
    }
    if (!nonEmpty(a.title, 3)) issues.push(`phase2_retrieval_${i}_title_weak`);
    if (!nonEmpty(a.activityType, 3)) issues.push(`phase2_retrieval_${i}_activityType_missing`);
    if (!nonEmpty(a.studentFacingImagePrompt, 30)) {
      issues.push(`phase2_retrieval_${i}_student_image_prompt_weak`);
    }
    if (!nonEmpty(a.teacherFacingBrief, 20)) {
      issues.push(`phase2_retrieval_${i}_teacher_brief_missing`);
    }
    if (!nonEmpty(a.studentTask, 12)) issues.push(`phase2_retrieval_${i}_student_task_weak`);

    if (a.labelsAllowedOnStudentImage === true) {
      issues.push(`phase2_retrieval_${i}_labels_not_allowed_on_student_image`);
    }
    if (a.studentSafe !== true) {
      issues.push(`phase2_retrieval_${i}_not_marked_student_safe`);
    }

    const leaks = findRevealLeaks(a.studentFacingImagePrompt);
    if (leaks.length > 0) {
      issues.push(`phase2_retrieval_${i}_student_image_reveals_answer`);
    }
    const banned = Array.isArray(a.bannedRevealTerms) ? a.bannedRevealTerms : [];
    if (studentImageRevealsAnswer(a.studentFacingImagePrompt, banned)) {
      if (!issues.includes(`phase2_retrieval_${i}_student_image_reveals_answer`)) {
        issues.push(`phase2_retrieval_${i}_student_image_reveals_answer`);
      }
    }

    // Teacher brief may mention answers; student image must not copy teacher answer language.
    const teacher = String(a.teacherFacingBrief || "").toLowerCase();
    const studentImg = String(a.studentFacingImagePrompt || "").toLowerCase();
    if (
      /correct|answer is|target/i.test(teacher) &&
      /correct|answer is|target cell|labelled correct/i.test(studentImg)
    ) {
      issues.push(`phase2_retrieval_${i}_student_image_copies_teacher_answer_language`);
    }
  });

  if (phase2.studentSafe !== true) issues.push("phase2_studentSafe_false");
  if (phase2.questionsFinalised === true) issues.push("phase2_questions_finalised");

  // Must still leave question placeholders — no final question banks here.
  if (Array.isArray(phase2.selfCheck) && phase2.selfCheck.length > 0) {
    issues.push("phase2_has_final_selfCheck");
  }
  if (Array.isArray(phase2.quiz) && phase2.quiz.length > 0) {
    issues.push("phase2_has_final_quiz");
  }

  // Phase 1 should exist when validating in pipeline (soft check).
  if (ctx.phase1 && ctx.phase1.status && ctx.phase1.status !== STAGE_STATUS.COMPLETE) {
    issues.push("phase2_requires_complete_phase1");
  }

  return { ok: issues.length === 0, issues };
}

module.exports = {
  validatePhase2VisualActivities,
};
