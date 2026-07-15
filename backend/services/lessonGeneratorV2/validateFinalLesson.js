/**
 * Final Lesson-shaped draft validator for V2 assembler (PR A).
 * Fail-closed before critic can mark ok=true. Does not write to DB.
 */

const { isBannedStem, findBannedStemHits } = require("./questionBanList");
const { findRevealLeaks, studentImageRevealsAnswer } = require("./studentImageSafety");
const { nearDuplicate, normalizeStem } = require("./validatePhase3Questions");

function nonEmpty(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function collectActivityQuestions(finalLesson) {
  const pages = Array.isArray(finalLesson?.pages) ? finalLesson.pages : [];
  let selfCheck = [];
  let checkpoint = [];
  for (const page of pages) {
    for (const block of page?.blocks || []) {
      if (block?.type === "selfCheck" && Array.isArray(block.questions)) {
        selfCheck = block.questions;
      }
      if (block?.type === "checkpoint" && Array.isArray(block.questions)) {
        checkpoint = block.questions;
      }
    }
  }
  const quiz = Array.isArray(finalLesson?.quiz?.questions) ? finalLesson.quiz.questions : [];
  return { selfCheck, checkpoint, quiz };
}

function stemOf(q) {
  return String(q?.prompt || q?.question || "").trim();
}

/**
 * @param {object} finalLesson
 * @param {{ phase2?: object, topic?: string }} [ctx]
 * @returns {{ ok: boolean, issues: string[] }}
 */
function validateFinalLesson(finalLesson, ctx = {}) {
  const issues = [];
  if (!finalLesson || typeof finalLesson !== "object") {
    return { ok: false, issues: ["finalLesson_missing"] };
  }

  for (const key of ["title", "description", "content", "subject", "level", "topic"]) {
    if (!nonEmpty(finalLesson[key], key === "title" ? 3 : 2)) {
      issues.push(`final_missing_${key}`);
    }
  }

  if (finalLesson.status !== "draft") issues.push("final_status_not_draft");
  if (finalLesson.isPublished !== false) issues.push("final_isPublished_not_false");
  if (finalLesson.metadata?.generator !== "v2" && finalLesson.pipeline !== "lesson-generator-v2") {
    issues.push("final_generator_not_v2");
  }

  const pages = Array.isArray(finalLesson.pages) ? finalLesson.pages : null;
  if (!pages || pages.length < 1) {
    issues.push("final_pages_missing");
  } else {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!nonEmpty(p?.pageId, 1)) issues.push(`final_page_${i}_missing_pageId`);
      if (!Array.isArray(p?.blocks) || p.blocks.length < 1) issues.push(`final_page_${i}_blocks_empty`);
    }
  }

  const teachingTypes = new Set(["text", "keyIdea", "keyWords", "examTip", "commonMistake"]);
  const teachingBlocks = (pages || [])
    .flatMap((p) => p.blocks || [])
    .filter((b) => teachingTypes.has(b?.type) && nonEmpty(b?.content, 8));
  if (teachingBlocks.length < 1) issues.push("final_teaching_blocks_empty");

  const { selfCheck, checkpoint, quiz } = collectActivityQuestions(finalLesson);
  if (selfCheck.length !== 3) issues.push("final_selfCheck_must_be_exactly_3");
  if (checkpoint.length !== 3) issues.push("final_checkpoint_must_be_exactly_3");
  if (quiz.length !== 5) issues.push("final_quiz_must_be_exactly_5");

  const topic = String(ctx.topic || finalLesson.topic || "").trim();
  const allQs = [...selfCheck, ...checkpoint, ...quiz];
  const stems = allQs.map(stemOf);

  allQs.forEach((q, i) => {
    const stem = stemOf(q);
    if (!nonEmpty(stem, 12)) issues.push(`final_q_${i}_stem_weak`);
    if (!nonEmpty(String(q?.correctAnswer || ""), 1)) issues.push(`final_q_${i}_answer_missing`);
    const bans = findBannedStemHits(stem, { topic });
    for (const b of bans) issues.push(`final_q_${i}_${b}`);
    if (/\bOption\s*[123]\b/i.test(stem)) issues.push(`final_q_${i}_option_filler_stem`);
    const opts = Array.isArray(q?.options) ? q.options : [];
    if (opts.some((o) => /^Option\s*[123]$/i.test(String(o || "").trim()))) {
      issues.push(`final_q_${i}_option_filler_choice`);
    }
    if (isBannedStem(stem, { topic })) {
      // already covered by findBannedStemHits; keep explicit for clarity in tests
    }
  });

  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      if (nearDuplicate(stems[i], stems[j])) {
        issues.push(`final_near_duplicate_stem:${i}:${j}`);
      }
    }
  }

  // Retrieval student-image safety from assembled metadata + phase2
  const phase2 = ctx.phase2 || finalLesson.metadata?.v2VisualPlan || {};
  const retrieval = Array.isArray(phase2.retrievalActivities) ? phase2.retrievalActivities : [];
  for (let i = 0; i < retrieval.length; i++) {
    const a = retrieval[i];
    const studentPrompt = String(a?.studentFacingImagePrompt || "").trim();
    if (findRevealLeaks(studentPrompt).length) {
      issues.push(`final_retrieval_${i}_image_reveal_leak`);
    }
    if (studentImageRevealsAnswer(studentPrompt, a?.bannedRevealTerms || [])) {
      issues.push(`final_retrieval_${i}_image_reveals_answer`);
    }
    if (a?.labelsAllowedOnStudentImage === true) {
      issues.push(`final_retrieval_${i}_labels_allowed_on_student_image`);
    }
  }

  // Student-facing page text must not include teacher briefs or CORRECT/TARGET cues
  const studentFacingText = (pages || [])
    .flatMap((p) => p.blocks || [])
    .filter((b) => b?.role === "retrievalActivity" || b?.type === "text")
    .map((b) => `${b.content || ""} ${b.v2StudentFacingImagePrompt || ""}`)
    .join("\n");
  if (findRevealLeaks(studentFacingText).length) {
    issues.push("final_student_facing_reveal_leak");
  }
  // Teacher briefs must not be pasted into student-facing content blocks.
  for (const a of retrieval) {
    const brief = String(a?.teacherFacingBrief || "").trim();
    if (brief.length >= 20) {
      const contentBlob = (pages || [])
        .flatMap((p) => p.blocks || [])
        .filter((b) => b?.role === "retrievalActivity")
        .map((b) => String(b?.content || ""))
        .join("\n");
      if (contentBlob.includes(brief)) {
        issues.push("final_teacher_brief_leaked_into_student_content");
      }
    }
  }

  if (!finalLesson.metadata?.v2VisualPlan) {
    issues.push("final_missing_v2VisualPlan");
  }

  return { ok: issues.length === 0, issues };
}

module.exports = {
  validateFinalLesson,
  collectActivityQuestions,
  normalizeStem,
};
