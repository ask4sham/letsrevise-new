/**
 * Phase 3H.0 — Concept Compression Engine.
 * Forces lessons to establish definition, purpose, core model and exam anchors early.
 * Prompt and diagnostics only — does not mutate saved lesson blocks.
 */

const { flattenPagesToBlocks, normalizeText, blockHaystack } = require("../lessonBlockAnalysis");
const {
  resolveConceptCompressionProfile,
} = require("./conceptCompressionProfiles");

const COMPRESSION_MARKER = "CONCEPT COMPRESSION:";

/** Max blocks from lesson start to scan for early framing. */
const EARLY_BLOCK_LIMIT = 8;

function isConceptCompressionEnabled() {
  return String(process.env.TEACHER_BRAIN_CONCEPT_COMPRESSION || "0").trim() === "1";
}

/**
 * @param {object} [input]
 * @returns {import("./conceptCompressionProfiles").ConceptCompressionProfile|null}
 */
function resolveCompressionProfile(input = {}) {
  if (!isConceptCompressionEnabled()) return null;
  return resolveConceptCompressionProfile(input);
}

/**
 * @param {import("./conceptCompressionProfiles").ConceptCompressionProfile} profile
 */
function buildConceptCompression(profile) {
  if (!profile) return null;

  return {
    taxonomyKey: profile.taxonomyKey,
    definition: profile.definition,
    whyItMatters: profile.whyItMatters,
    gcseExamples: profile.gcseExamples || [],
    coreModel: profile.coreModel,
    examAnchors: profile.examAnchors || [],
  };
}

/**
 * @param {import("./conceptCompressionProfiles").ConceptCompressionProfile|null} profile
 */
function formatConceptCompressionAppendix(profile) {
  if (!isConceptCompressionEnabled() || !profile) return "";

  const compression = buildConceptCompression(profile);
  if (!compression) return "";

  const lines = [
    COMPRESSION_MARKER,
    "",
    "Place this conceptual framework near the START of the lesson (after objectives / prior knowledge, before detailed teaching):",
    "",
    "Definition:",
    compression.definition,
    "",
    "Why It Matters:",
    compression.whyItMatters,
  ];

  if (compression.gcseExamples?.length) {
    lines.push("", "GCSE Examples:", ...compression.gcseExamples.map((e) => `- ${e}`));
  }

  lines.push(
    "",
    "Core Model:",
    compression.coreModel,
    "",
    "Exam Anchors (use these terms repeatedly in early teaching and first checkpoint):",
    ...compression.examAnchors.map((a) => `- ${a}`),
    "",
    "RULE: Do not bury the core model deep in the lesson. Students must meet the definition, why-it-matters, core model and exam anchors before extended activities."
  );

  return lines.join("\n");
}

function haystackIncludesAny(hay, terms = []) {
  const h = normalizeText(hay);
  if (!h) return false;
  return terms.some((term) => {
    const t = normalizeText(term);
    return t && h.includes(t);
  });
}

function countAnchorMatches(hay, anchorTerms = []) {
  const h = normalizeText(hay);
  if (!h) return { matched: [], count: 0 };
  const matched = [];
  for (const entry of anchorTerms) {
    const term = typeof entry === "string" ? entry : entry.term;
    const label = typeof entry === "string" ? entry : entry.label;
    const t = normalizeText(term);
    if (t && h.includes(t) && !matched.includes(label)) {
      matched.push(label);
    }
  }
  return { matched, count: matched.length };
}

/**
 * Extract haystack from first N blocks (early lesson framing).
 * @param {object[]} pages
 */
function earlyLessonHaystack(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const early = blocks.slice(0, EARLY_BLOCK_LIMIT);
  return normalizeText(early.map((b) => blockHaystack(b)).join(" "));
}

/**
 * Score whether compression elements appear early in the lesson.
 * @param {object} input
 * @param {object[]} [input.pages]
 * @param {import("./conceptCompressionProfiles").ConceptCompressionProfile} input.profile
 */
function scoreConceptCompressionCoverage(input = {}) {
  const profile = input.profile;
  if (!profile) {
    return {
      enabled: false,
      compressionScorePct: 0,
      definitionPresent: false,
      whyItMattersPresent: false,
      coreModelPresent: false,
      examAnchorsCovered: 0,
      examAnchorsTotal: 0,
      examAnchorsMatched: [],
      examAnchorsMissing: [],
      earlyBlockCount: 0,
      gaps: [],
      warnings: [],
    };
  }

  const hay = earlyLessonHaystack(input.pages);
  const blocks = flattenPagesToBlocks(input.pages);
  const earlyCount = Math.min(blocks.length, EARLY_BLOCK_LIMIT);

  const definitionPresent = haystackIncludesAny(hay, profile.definitionMatchTerms || []);
  const whyItMattersPresent = haystackIncludesAny(hay, profile.whyMatchTerms || []);
  const coreModelPresent = haystackIncludesAny(hay, profile.coreModelMatchTerms || []);

  const anchorTerms = profile.examAnchorTerms || (profile.examAnchors || []).map((a) => ({
    term: a.toLowerCase(),
    label: a,
  }));
  const { matched, count } = countAnchorMatches(hay, anchorTerms);
  const totalAnchors = profile.examAnchors?.length || anchorTerms.length;
  const missing = (profile.examAnchors || []).filter((a) => !matched.includes(a));

  const checks = [definitionPresent, whyItMattersPresent, coreModelPresent, count >= Math.min(3, totalAnchors)];
  const passed = checks.filter(Boolean).length;
  const compressionScorePct = Math.round((passed / checks.length) * 100);

  const gaps = [];
  if (!definitionPresent) {
    gaps.push(`Add definition near lesson start: "${profile.definition.slice(0, 80)}…"`);
  }
  if (!whyItMattersPresent) {
    gaps.push(`Add "Why It Matters" near lesson start: "${profile.whyItMatters.slice(0, 80)}…"`);
  }
  if (!coreModelPresent) {
    gaps.push(`Establish core model early: ${profile.coreModel}`);
  }
  if (count < Math.min(3, totalAnchors)) {
    gaps.push(
      `Exam anchors under-covered in early blocks (${count}/${totalAnchors}). Missing: ${missing.slice(0, 4).join(", ") || "several anchors"}`
    );
  }

  return {
    enabled: isConceptCompressionEnabled(),
    taxonomyKey: profile.taxonomyKey,
    compressionScorePct,
    definitionPresent,
    whyItMattersPresent,
    coreModelPresent,
    examAnchorsCovered: count,
    examAnchorsTotal: totalAnchors,
    examAnchorsMatched: matched,
    examAnchorsMissing: missing,
    earlyBlockCount: earlyCount,
    expectedCompression: buildConceptCompression(profile),
    gaps,
    warnings: gaps,
  };
}

module.exports = {
  COMPRESSION_MARKER,
  EARLY_BLOCK_LIMIT,
  isConceptCompressionEnabled,
  resolveCompressionProfile,
  resolveConceptCompressionProfile,
  buildConceptCompression,
  formatConceptCompressionAppendix,
  scoreConceptCompressionCoverage,
  earlyLessonHaystack,
};
