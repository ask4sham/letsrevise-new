/**
 * Phase 3H.1.8b.2b — Memory Rule scope authority (profile → prompt → autofix → gate).
 */

const { resolveSubTopicProfile } = require("./subTopicProfiles");
const { getSubTopicBoundaryMode } = require("./subTopicBoundaryGuard");
const { replaceBlockAtSpan } = require("./scopeBlockUtils");
const {
  findClosingDriftTermsInText,
  listMemoryRuleBlockSpans,
  extractClosingBlockBody,
} = require("./closingScopeUtils");

function shouldApplyMemoryRuleAutofix(profile) {
  if (!profile || !profileMemoryRuleParagraphs(profile).length) return false;
  if (getSubTopicBoundaryMode() >= 2) return true;
  return String(process.env.TEACHER_BRAIN_MEMORY_RULE_AUTHORITY || "1").trim() === "1";
}

function profileMemoryRuleParagraphs(profile) {
  if (!profile || !Array.isArray(profile.memoryRuleParagraphs)) return [];
  return profile.memoryRuleParagraphs.filter((p) => p && String(p).trim());
}

function memoryRuleBodyFromParagraphs(paragraphs = []) {
  const rows = paragraphs.filter(Boolean);
  const lines = ["<h2><strong>💡 Key Insight</strong></h2>"];
  rows.forEach((paragraph) => {
    lines.push(`<p>${String(paragraph).trim()}</p>`);
  });
  return lines.join("\n");
}

function analyzeMemoryRuleBlock(body = "") {
  const driftTerms = findClosingDriftTermsInText(body);
  return { contaminated: driftTerms.length > 0, driftTerms };
}

function buildSs1Layer2MandatoryMemoryRuleSection(profile) {
  const paragraphs = profileMemoryRuleParagraphs(profile);
  if (!profile || !paragraphs.length) return "";

  return [
    "--------------------------------",
    "TEACHER-FIRST LAYER 2 — MANDATORY MEMORY RULE (SS1 SCOPE AUTHORITY)",
    "--------------------------------",
    "",
    "Block FINAL MEMORY RULE must state ONLY this core pathway insight:",
    ...paragraphs.map((p) => `- ${p}`),
    "",
    "FORBIDDEN in Memory Rule / Key Insight (unless explicitly marked as a future-lesson preview):",
    "- cerebellum, cerebral cortex, cortex, medulla",
    "- thermoregulation, hypothalamus, sweating, vasodilation",
    "- retina, lens, iris, pupil, accommodation",
    "",
    "Memory Rule is ONE pathway insight — not a whole-unit recap.",
    "Do NOT append paragraphs about brain regions, eye structure, or temperature control.",
  ].join("\n");
}

function ensureMemoryRuleScopeCompliance(
  text = "",
  { topic = "", topicKey = "", subTopic = "" } = {},
  fixes = []
) {
  const profile = resolveSubTopicProfile({ topicKey, topic, subTopic: subTopic || topic });
  const paragraphs = profileMemoryRuleParagraphs(profile);
  if (!profile || !shouldApplyMemoryRuleAutofix(profile) || !paragraphs.length) {
    return { text, changed: false, profile, replacements: [] };
  }

  const spans = listMemoryRuleBlockSpans(text);
  if (!spans.length) {
    return { text, changed: false, profile, replacements: [] };
  }

  let working = text;
  let changed = false;
  const replacements = [];

  for (let idx = spans.length - 1; idx >= 0; idx--) {
    const span = spans[idx];
    const body = extractClosingBlockBody(span.text);
    const analysis = analyzeMemoryRuleBlock(body);
    if (!analysis.contaminated) continue;

    const pasteLine =
      span.text.split("\n").find((l) => /^Paste into:/i.test(l.trim())) ||
      "Paste into: Final memory rule (key idea)";
    const newBody = memoryRuleBodyFromParagraphs(paragraphs);
    const newBlock = `${span.headerLine}\n${pasteLine}\n\n${newBody}\n`;
    working = replaceBlockAtSpan(working, span, newBlock);
    changed = true;
    replacements.push({ driftTerms: analysis.driftTerms, headerLine: span.headerLine });
  }

  if (changed) {
    fixes.push(
      `Memory Rule authority: rewrote ${replacements.length} contaminated memory rule block(s).`
    );
  }

  return { text: working, changed, profile, replacements };
}

function collectMemoryRuleHaystack(lessonText = "") {
  return listMemoryRuleBlockSpans(lessonText)
    .map((s) => extractClosingBlockBody(s.text))
    .join("\n");
}

function evaluateMemoryRuleAuthorityGate(lessonText = "", meta = {}) {
  const profile =
    meta.subTopicProfile ||
    resolveSubTopicProfile({
      topicKey: meta.topicKey,
      topic: meta.topic,
      subTopic: meta.subTopic || meta.topic,
    });

  const paragraphs = profileMemoryRuleParagraphs(profile);
  if (!profile || !paragraphs.length) {
    return { pass: true, skipped: true, driftTermsFound: [], violations: [], warnings: [] };
  }

  const spans = listMemoryRuleBlockSpans(lessonText);
  const haystack = collectMemoryRuleHaystack(lessonText);
  const driftTermsFound = findClosingDriftTermsInText(haystack);

  const violations = [];
  for (const span of spans) {
    const analysis = analyzeMemoryRuleBlock(extractClosingBlockBody(span.text));
    if (analysis.contaminated) {
      violations.push({ driftTerms: analysis.driftTerms, headerLine: span.headerLine });
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
        ? [`${violations.length} memory rule scope violation(s) remain.`]
        : [],
  };
}

module.exports = {
  buildSs1Layer2MandatoryMemoryRuleSection,
  ensureMemoryRuleScopeCompliance,
  evaluateMemoryRuleAuthorityGate,
  memoryRuleBodyFromParagraphs,
  profileMemoryRuleParagraphs,
  analyzeMemoryRuleBlock,
};
