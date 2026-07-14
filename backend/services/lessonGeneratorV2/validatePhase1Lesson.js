/**
 * Phase 1 Lesson Brain quality gate.
 * Ensures teaching content exists and questions/images are not finalised.
 */

const { PHASE1_REQUIRED_PLACEHOLDERS } = require("./placeholders");
const { STAGE_STATUS } = require("./schemas");

function nonEmptyString(v, min = 1) {
  return typeof v === "string" && v.trim().length >= min;
}

function looksLikeFinalisedQuestionBank(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.some((q) => {
    if (!q || typeof q !== "object") return false;
    const prompt = String(q.prompt || q.question || q.stem || "").trim();
    return prompt.length >= 8;
  });
}

function sectionHasSubstance(section) {
  if (!section || typeof section !== "object") return false;
  return nonEmptyString(section.title, 3) && nonEmptyString(section.content, 40);
}

/**
 * @param {object} phase1
 * @returns {{ ok: boolean, issues: string[] }}
 */
function validatePhase1Lesson(phase1) {
  const issues = [];
  if (!phase1 || typeof phase1 !== "object") {
    return { ok: false, issues: ["phase1_missing"] };
  }

  if (phase1.status !== STAGE_STATUS.COMPLETE) {
    issues.push(`phase1_status_not_complete:${phase1.status || "missing"}`);
  }

  if (!nonEmptyString(phase1.title, 3)) issues.push("phase1_title_missing");
  if (!nonEmptyString(phase1.topic, 2)) issues.push("phase1_topic_missing");
  if (!nonEmptyString(phase1.subject, 2)) issues.push("phase1_subject_missing");
  if (!nonEmptyString(phase1.examBoard, 2) && !nonEmptyString(phase1.board, 2)) {
    issues.push("phase1_examBoard_missing");
  }
  if (!nonEmptyString(phase1.level, 2)) issues.push("phase1_level_missing");

  if (!Array.isArray(phase1.objectives) || phase1.objectives.filter((o) => nonEmptyString(o, 8)).length < 2) {
    issues.push("phase1_objectives_too_weak");
  }
  if (!nonEmptyString(phase1.priorKnowledge, 20)) issues.push("phase1_priorKnowledge_too_weak");

  const sections = Array.isArray(phase1.sections) ? phase1.sections : [];
  const strongSections = sections.filter(sectionHasSubstance);
  if (strongSections.length < 3) {
    issues.push(`phase1_sections_too_weak:got_${strongSections.length}_need_3`);
  }

  if (!Array.isArray(phase1.keyTerms) || phase1.keyTerms.filter((t) => nonEmptyString(t, 2)).length < 3) {
    issues.push("phase1_keyTerms_too_weak");
  }
  if (
    !Array.isArray(phase1.misconceptions) ||
    phase1.misconceptions.filter((m) => nonEmptyString(typeof m === "string" ? m : m?.wrong || m?.content, 12))
      .length < 1
  ) {
    issues.push("phase1_misconceptions_missing");
  }
  if (!Array.isArray(phase1.examTips) || phase1.examTips.filter((t) => nonEmptyString(t, 12)).length < 1) {
    issues.push("phase1_examTips_missing");
  }
  if (!nonEmptyString(phase1.summary, 30)) issues.push("phase1_summary_too_weak");

  const placeholders = Array.isArray(phase1.placeholders) ? phase1.placeholders.map(String) : [];
  for (const required of PHASE1_REQUIRED_PLACEHOLDERS) {
    if (!placeholders.includes(required)) {
      issues.push(`phase1_missing_placeholder:${required}`);
    }
  }

  // Must not finalise Phase 2/3 artefacts.
  if (phase1.questionsFinalised === true) issues.push("phase1_questions_finalised");
  if (phase1.imagePromptsFinalised === true) issues.push("phase1_image_prompts_finalised");

  if (looksLikeFinalisedQuestionBank(phase1.selfCheck)) issues.push("phase1_has_final_selfCheck");
  if (looksLikeFinalisedQuestionBank(phase1.checkpoint)) issues.push("phase1_has_final_checkpoint");
  if (looksLikeFinalisedQuestionBank(phase1.quiz)) issues.push("phase1_has_final_quiz");
  if (looksLikeFinalisedQuestionBank(phase1.revision)) issues.push("phase1_has_final_revision");

  if (Array.isArray(phase1.imagePrompts) && phase1.imagePrompts.length > 0) {
    issues.push("phase1_has_final_imagePrompts");
  }
  if (Array.isArray(phase1.activityPrompts) && phase1.activityPrompts.length > 0) {
    issues.push("phase1_has_final_activityPrompts");
  }

  // Topic-specific teaching signal: topic word or biology teaching vocabulary present.
  const hay = [
    phase1.summary,
    ...(phase1.objectives || []),
    ...strongSections.map((s) => `${s.title} ${s.content}`),
  ]
    .join(" ")
    .toLowerCase();
  const topicToken = String(phase1.topic || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)[0];
  const biologySignal =
    /cell|nucleus|organelle|enzyme|photosynthesis|respiration|homeostasis|feedback|hormone|gamete|meiosis|mitosis|diffusion|osmosis|gene|allele|ecosystem|pathogen|immunity|digestion|circulation|plant|animal|biology/i.test(
      hay
    );
  if (topicToken && !hay.includes(topicToken) && !biologySignal) {
    issues.push("phase1_not_topic_specific");
  }
  if (!biologySignal && String(phase1.subject || "").toLowerCase().includes("biology")) {
    issues.push("phase1_biology_teaching_signal_missing");
  }

  return { ok: issues.length === 0, issues };
}

module.exports = {
  validatePhase1Lesson,
};
