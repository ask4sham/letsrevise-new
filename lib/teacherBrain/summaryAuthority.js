/**
 * Phase 3H.1.8b.2a — Summary scope authority (profile → prompt → autofix → gate).
 */

const { resolveSubTopicProfile } = require("./subTopicProfiles");
const { getSubTopicBoundaryMode } = require("./subTopicBoundaryGuard");
const { replaceBlockAtSpan } = require("./scopeBlockUtils");
const {
  findClosingDriftTermsInText,
  listSummaryBlockSpans,
  extractSummaryBlockBody,
} = require("./closingScopeUtils");

function shouldApplySummaryAutofix(profile) {
  if (!profile || !profileSummaryBullets(profile).length) return false;
  if (getSubTopicBoundaryMode() >= 2) return true;
  return String(process.env.TEACHER_BRAIN_SUMMARY_AUTHORITY || "1").trim() === "1";
}

function profileSummaryBullets(profile) {
  if (!profile || !Array.isArray(profile.summaryBullets)) return [];
  return profile.summaryBullets.filter((b) => b && String(b).trim());
}

function summaryBodyFromBullets(bullets = []) {
  const rows = bullets.filter(Boolean);
  const lines = ["<h2><strong>Summary</strong></h2>", "<ul>"];
  rows.forEach((bullet) => {
    lines.push(`<li>${String(bullet).trim()}</li>`);
  });
  lines.push(
    "</ul>",
    "<p><strong>Remember:</strong> 👉 Link structure to function and explain the full stimulus → response pathway using precise GCSE terms.</p>"
  );
  return lines.join("\n");
}

function analyzeSummaryBlock(body = "") {
  const driftTerms = findClosingDriftTermsInText(body);
  return { contaminated: driftTerms.length > 0, driftTerms };
}

function buildSs1Layer2MandatorySummarySection(profile) {
  const bullets = profileSummaryBullets(profile);
  if (!profile || !bullets.length) return "";

  return [
    "--------------------------------",
    "TEACHER-FIRST LAYER 2 — MANDATORY SUMMARY (SS1 SCOPE AUTHORITY)",
    "--------------------------------",
    "",
    "Block SUMMARY must recap ONLY this sub-topic using these points:",
    ...bullets.map((b) => `- ${b}`),
    "",
    "FORBIDDEN in Summary (unless explicitly marked as a future-lesson preview):",
    "- cerebellum, cerebral cortex, cortex, medulla",
    "- thermoregulation, hypothalamus, sweating, vasodilation",
    "- retina, lens, iris, pupil, accommodation",
    "",
    "ALLOWED preview format (only if needed — do not name forbidden structures):",
    '- "Brain regions are covered in a later lesson."',
    "",
    "Summary must NOT introduce brain region functions, eye anatomy, or temperature control.",
  ].join("\n");
}

function ensureSummaryScopeCompliance(
  text = "",
  { topic = "", topicKey = "", subTopic = "" } = {},
  fixes = []
) {
  const profile = resolveSubTopicProfile({ topicKey, topic, subTopic: subTopic || topic });
  const bullets = profileSummaryBullets(profile);
  if (!profile || !shouldApplySummaryAutofix(profile) || !bullets.length) {
    return { text, changed: false, profile, replacements: [] };
  }

  const spans = listSummaryBlockSpans(text);
  if (!spans.length) {
    return { text, changed: false, profile, replacements: [] };
  }

  let working = text;
  let changed = false;
  const replacements = [];

  for (let idx = spans.length - 1; idx >= 0; idx--) {
    const span = spans[idx];
    const body = extractSummaryBlockBody(span.text);
    const analysis = analyzeSummaryBlock(body);
    if (!analysis.contaminated) continue;

    const pasteLine =
      span.text.split("\n").find((l) => /^Paste into:/i.test(l.trim())) ||
      "Paste into: Text (concept)";
    const newBody = summaryBodyFromBullets(bullets);
    const newBlock = `${span.headerLine}\n${pasteLine}\n\n${newBody}\n`;
    working = replaceBlockAtSpan(working, span, newBlock);
    changed = true;
    replacements.push({ driftTerms: analysis.driftTerms });
  }

  if (changed) {
    fixes.push(
      `Summary authority: rewrote ${replacements.length} contaminated summary block(s).`
    );
  }

  return { text: working, changed, profile, replacements };
}

function collectSummaryHaystack(lessonText = "") {
  return listSummaryBlockSpans(lessonText)
    .map((s) => extractSummaryBlockBody(s.text))
    .join("\n");
}

function evaluateSummaryAuthorityGate(lessonText = "", meta = {}) {
  const profile =
    meta.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: meta.topicKey,
      topic: meta.topic,
      subTopic: meta.subTopic || meta.topic,
    });

  const bullets = profileSummaryBullets(profile);
  if (!profile || !bullets.length) {
    return { pass: true, skipped: true, driftTermsFound: [], violations: [], warnings: [] };
  }

  const spans = listSummaryBlockSpans(lessonText);
  const haystack = collectSummaryHaystack(lessonText);
  const driftTermsFound = findClosingDriftTermsInText(haystack);

  const violations = [];
  for (const span of spans) {
    const analysis = analyzeSummaryBlock(extractSummaryBlockBody(span.text));
    if (analysis.contaminated) {
      violations.push({ driftTerms: analysis.driftTerms });
    }
  }

  const pass = driftTermsFound.length === 0 && violations.length === 0;

  return {
    pass,
    skipped: false,
    driftTermsFound,
    violations,
    blockCount: spans.length,
    warnings:
      violations.length > 0
        ? [`${violations.length} summary scope violation(s) remain.`]
        : [],
  };
}

module.exports = {
  buildSs1Layer2MandatorySummarySection,
  ensureSummaryScopeCompliance,
  evaluateSummaryAuthorityGate,
  summaryBodyFromBullets,
  profileSummaryBullets,
  analyzeSummaryBlock,
  findClosingDriftTermsInText,
};
