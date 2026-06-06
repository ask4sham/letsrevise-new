/**
 * Phase 3H.1.8a.1 — Read-only placeholder, dual-output, and opening-slot quality gates (no mutation).
 */

const { getSs1BlockNumber } = require("./teacherFirstSs1Architecture");
const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");

const PLACEHOLDER_PATTERNS = [
  { id: "coreModelBracket", rx: /\[The key GCSE model or pathway/i },
  { id: "exampleBracket", rx: /\[example\s*\d/i },
  { id: "termBracket", rx: /\[term\s*\d/i },
  { id: "priorIdeaBracket", rx: /\[prior idea\s*\d/i },
  { id: "definitionBracket", rx: /\[One clear GCSE definition|\[Clear GCSE definition of/i },
  { id: "whyMattersBracket", rx: /\[One sentence on why/i },
  { id: "scenarioBracket", rx: /\[One short scenario|\[One short example that illustrates/i },
];

const ALLOWED_PREAMBLE_PATTERNS = [
  /^LESSON OBJECTIVE FIELD:/im,
  /^SHORT SUMMARY FIELD:/im,
  /^PAGE\s+\d+/im,
  /^<strong>[^<]+<\/strong>\s*$/im,
  /^\s*$/,
];

function extractBlockBody(text, titleRx) {
  const chunks = String(text || "").split(/\n(?=\d+\s*[—\-–]\s+)/);
  for (const chunk of chunks) {
    const header = chunk.match(/^\d+\s*[—\-–]\s+([^\n]+)/);
    if (!header || !titleRx.test(header[1])) continue;
    return chunk.replace(/^[^\n]+\n(?:Paste into:[^\n]+\n)?/i, "").trim();
  }
  return "";
}

function stripAllowedPreamble(preamble) {
  let rest = String(preamble || "");
  rest = rest.replace(
    /^LESSON OBJECTIVE FIELD:\s*(?:\r?\n(?!\s*(?:SHORT SUMMARY FIELD:|PAGE\s+\d|<strong>|\d+\s*[—\-–]))[^\r\n]*)*/im,
    ""
  );
  rest = rest.replace(
    /^SHORT SUMMARY FIELD:\s*(?:\r?\n(?!\s*(?:PAGE\s+\d|<strong>|\d+\s*[—\-–]))[^\r\n]*)*/im,
    ""
  );
  rest = rest.replace(/^PAGE\s+\d+\s*$/gim, "");
  rest = rest.replace(/<strong>[^<]*<\/strong>/gi, "");
  return rest.trim();
}

/**
 * Detect autofix/prompt scaffold placeholders surviving in output.
 * @param {string} text
 */
function detectUnresolvedPlaceholders(text = "") {
  const full = String(text || "");
  const hits = [];

  for (const { id, rx } of PLACEHOLDER_PATTERNS) {
    if (rx.test(full)) hits.push(id);
  }

  const openingBlocks = [
    extractBlockBody(full, /definition/i),
    extractBlockBody(full, /core\s+model/i),
    extractBlockBody(full, /key\s+examples/i),
    extractBlockBody(full, /exam\s+vocabulary/i),
  ].join("\n");

  return {
    pass: hits.length === 0,
    hits,
    openingBlockSample: openingBlocks.slice(0, 400),
  };
}

/**
 * Detect freeform lesson content before the first numbered SS1 block (dual output).
 * @param {string} text
 */
function detectDualOutput(text = "") {
  const lines = String(text || "").split(/\r?\n/);
  let firstBlockLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/^\d+\s*[—\-–]\s+LESSON OBJECTIVES/i.test(lines[i])) {
      firstBlockLine = i;
      break;
    }
  }

  if (firstBlockLine <= 0) {
    return { pass: true, reason: "no_preamble_or_single_block_start" };
  }

  const preamble = lines.slice(0, firstBlockLine).join("\n");
  const stripped = stripAllowedPreamble(preamble);

  const hasTeachingPreamble =
    /<h2\b/i.test(stripped) ||
    /<h3\b/i.test(stripped) ||
    /<ul\b/i.test(stripped) ||
    /<ol\b/i.test(stripped) ||
    /<table\b/i.test(stripped);

  return {
    pass: !hasTeachingPreamble,
    preambleLines: firstBlockLine,
    strippedPreambleLength: stripped.length,
    strippedPreambleSample: stripped.slice(0, 300),
  };
}

function normalizeHay(hay) {
  return String(hay || "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hayIncludesTerm(hay, term) {
  const t = normalizeHay(term);
  if (!t) return false;
  if (hay.includes(t)) return true;
  if (t.includes("neurone")) {
    return hay.includes(t.replace("neurone", "neuron"));
  }
  return false;
}

/**
 * Validate blocks 5–7 against profile openingSlots when present.
 * @param {string} text
 * @param {import("./teachingQualityProfiles.js").TeachingQualityProfile|null} profile
 */
function validateOpeningSlots(text = "", profile = null) {
  if (!profile?.openingSlots) {
    return { pass: true, skipped: true, reason: "no_opening_slots_profile" };
  }

  const { coreModel, keyExamples = [], examVocabulary = [] } = profile.openingSlots;
  const coreBody = extractBlockBody(text, /core\s+model/i);
  const examplesBody = extractBlockBody(text, /key\s+examples/i);
  const vocabBody = extractBlockBody(text, /exam\s+vocabulary/i);

  const coreHay = normalizeHay(coreBody);
  const examplesHay = normalizeHay(examplesBody);
  const vocabHay = normalizeHay(vocabBody);

  const coreModelTerms = String(coreModel || "")
    .split(/\s*→\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const missingCoreTerms = coreModelTerms.filter((term) => !hayIncludesTerm(coreHay, term));
  const missingExamples = keyExamples.filter((ex) => !hayIncludesTerm(examplesHay, ex));
  const missingVocab = examVocabulary.filter((term) => !hayIncludesTerm(vocabHay, term));

  return {
    pass: missingCoreTerms.length === 0 && missingExamples.length === 0 && missingVocab.length === 0,
    coreModel: { bodyLength: coreBody.length, missingTerms: missingCoreTerms },
    keyExamples: { missing: missingExamples },
    examVocabulary: { missing: missingVocab },
    blocks: {
      coreModel: getSs1BlockNumber("coreModel"),
      keyExamples: getSs1BlockNumber("keyExamples"),
      examVocabulary: getSs1BlockNumber("examVocabulary"),
    },
  };
}

/**
 * Combined 3H.1.8a.1 quality gate (read-only).
 * @param {string} text
 * @param {{ topic?: string, title?: string, subTopic?: string }} meta
 */
function evaluateTeachingQualityGate(text = "", meta = {}) {
  const profile = resolveTeachingQualityProfile(meta);
  const placeholders = detectUnresolvedPlaceholders(text);
  const dualOutput = detectDualOutput(text);
  const openingSlots = validateOpeningSlots(text, profile);

  const pass =
    placeholders.pass && dualOutput.pass && openingSlots.pass;

  return {
    profileKey: profile?.taxonomyKey || null,
    placeholders,
    dualOutput,
    openingSlots,
    pass,
  };
}

module.exports = {
  PLACEHOLDER_PATTERNS,
  detectUnresolvedPlaceholders,
  detectDualOutput,
  validateOpeningSlots,
  evaluateTeachingQualityGate,
};
