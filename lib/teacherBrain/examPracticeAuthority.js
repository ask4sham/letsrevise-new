/**
 * Phase 3H.1.8b.1 Step 2 — Exam Practice scope authority.
 */

const { resolveSubTopicProfile } = require("./subTopicProfiles");
const { getSubTopicBoundaryMode } = require("./subTopicBoundaryGuard");
const { findDriftTermsInText } = require("./objectivesAuthority");
const {
  detectBlockedInteractionKey,
  resolveAuthorityProfile,
} = require("./interactionAuthorityLayer");
const {
  replaceBlockAtSpan,
  listAssessmentBlockSpans,
} = require("./scopeBlockUtils");

function shouldApplyExamPracticeAutofix(profile) {
  if (!profile) return false;
  if (getSubTopicBoundaryMode() >= 2) return true;
  return String(process.env.TEACHER_BRAIN_EXAM_PRACTICE_AUTHORITY || "1").trim() === "1";
}

function profileExamPracticeStems(profile) {
  if (!profile || !Array.isArray(profile.examPracticeStems)) return [];
  return profile.examPracticeStems.filter((s) => s && s.q);
}

function examPracticeBodyFromStems(stems = []) {
  const rows = stems.slice(0, 4);
  const lines = ["<h2><strong>Exam practice</strong></h2>"];
  rows.forEach((stem, i) => {
    const marks = stem.marks || [1, 2, 3, 4][i] || 1;
    lines.push(`<p><strong>Q${i + 1} (${marks} mark${marks === 1 ? "" : "s"}):</strong> ${stem.q}</p>`);
  });
  lines.push("<details>", "<summary>Reveal Model Answers</summary>");
  rows.forEach((stem, i) => {
    lines.push(`<p><strong>Q${i + 1}:</strong> ${stem.answer || "Use precise GCSE terminology and a clear cause → effect chain."}</p>`);
  });
  lines.push("</details>");
  return lines.join("\n");
}

function analyzeExamPracticeBlock(body, authorityProfile) {
  const driftTerms = findDriftTermsInText(body);
  const blockedKey = authorityProfile ? detectBlockedInteractionKey(body, authorityProfile) : null;
  const contaminated = driftTerms.length > 0 || Boolean(blockedKey);
  return { contaminated, driftTerms, blockedKey };
}

function buildSs1Layer2MandatoryExamPracticeSection(profile) {
  const stems = profileExamPracticeStems(profile);
  if (!profile || !stems.length) return "";

  return [
    "--------------------------------",
    "TEACHER-FIRST LAYER 2 — MANDATORY EXAM PRACTICE (SS1 SCOPE AUTHORITY)",
    "--------------------------------",
    "",
    "Block EXAM PRACTICE must use ONLY in-scope questions for this sub-topic:",
    ...stems.map((s, i) => `- Q${i + 1} (${s.marks} marks): ${s.q}`),
    "",
    "FORBIDDEN in Exam Practice:",
    "- Cerebellum / cerebral cortex / medulla function questions",
    "- Thermoregulation, sweating, vasodilation, hypothalamus",
    "- Eye accommodation, iris, pupil, retina structure",
    "- Brain region essays or sport/coordination scenarios using brain regions",
  ].join("\n");
}

function ensureExamPracticeScopeCompliance(
  text = "",
  { topic = "", topicKey = "", subTopic = "" } = {},
  fixes = []
) {
  const profile = resolveSubTopicProfile({ topicKey, topic, subTopic: subTopic || topic });
  if (!profile || !shouldApplyExamPracticeAutofix(profile)) {
    return { text, changed: false, profile, replacements: [] };
  }

  const authorityProfile = resolveAuthorityProfile(profile);
  const stems = profileExamPracticeStems(profile);
  if (!stems.length) {
    return { text, changed: false, profile, replacements: [] };
  }

  const spans = listAssessmentBlockSpans(text).filter((s) => s.kind === "examPractice");
  if (!spans.length) {
    return { text, changed: false, profile, replacements: [] };
  }

  let working = text;
  let changed = false;
  const replacements = [];

  for (let idx = spans.length - 1; idx >= 0; idx--) {
    const span = spans[idx];
    const analysis = analyzeExamPracticeBlock(span.text, authorityProfile);
    if (!analysis.contaminated) continue;

    const pasteLine =
      span.text.split("\n").find((l) => /^Paste into:/i.test(l.trim())) ||
      "Paste into: Text (concept)";
    const newBody = examPracticeBodyFromStems(stems);
    const newBlock = `${span.headerLine}\n${pasteLine}\n\n${newBody}\n`;
    working = replaceBlockAtSpan(working, span, newBlock);
    changed = true;
    replacements.push({
      driftTerms: analysis.driftTerms,
      blockedKey: analysis.blockedKey,
    });
  }

  if (changed) {
    fixes.push(
      `Exam Practice authority: rewrote ${replacements.length} contaminated exam practice block(s).`
    );
  }

  return { text: working, changed, profile, replacements };
}

function collectExamPracticeHaystack(lessonText = "") {
  return listAssessmentBlockSpans(lessonText)
    .filter((s) => s.kind === "examPractice")
    .map((s) => s.text)
    .join("\n");
}

function evaluateExamPracticeAuthorityGate(lessonText = "", meta = {}) {
  const profile =
    meta.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: meta.topicKey,
      topic: meta.topic,
      subTopic: meta.subTopic || meta.topic,
    });

  const haystack = collectExamPracticeHaystack(lessonText);
  const driftTermsFound = profile ? findDriftTermsInText(haystack) : [];
  const authorityProfile = profile ? resolveAuthorityProfile(profile) : null;

  const violations = [];
  if (authorityProfile) {
    for (const span of listAssessmentBlockSpans(lessonText).filter((s) => s.kind === "examPractice")) {
      const analysis = analyzeExamPracticeBlock(span.text, authorityProfile);
      if (analysis.contaminated) {
        violations.push({
          driftTerms: analysis.driftTerms,
          blockedKey: analysis.blockedKey,
        });
      }
    }
  }

  const pass = driftTermsFound.length === 0 && violations.length === 0;

  return {
    pass,
    driftTermsFound,
    violations,
    blockCount: listAssessmentBlockSpans(lessonText).filter((s) => s.kind === "examPractice").length,
    warnings:
      violations.length > 0
        ? [`${violations.length} exam practice scope violation(s) remain.`]
        : [],
  };
}

module.exports = {
  buildSs1Layer2MandatoryExamPracticeSection,
  ensureExamPracticeScopeCompliance,
  evaluateExamPracticeAuthorityGate,
  examPracticeBodyFromStems,
  profileExamPracticeStems,
  analyzeExamPracticeBlock,
};
