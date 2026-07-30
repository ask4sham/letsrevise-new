/**
 * Deterministic source fingerprint for V2.3 MCQ rationale candidates.
 * Hashes educational source fields only — not updatedAt, actor, model, or prompt version.
 */
const crypto = require("crypto");

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((o) => normalizeText(o));
}

function normalizeMarkScheme(markScheme) {
  if (!Array.isArray(markScheme)) {
    if (markScheme == null || markScheme === "") return [];
    return [normalizeText(markScheme)].filter(Boolean);
  }
  return markScheme.map((line) => normalizeText(line)).filter((line) => line.length > 0);
}

/**
 * Build the canonical object used for hashing (key order fixed).
 * @param {object} input
 */
function buildCanonicalSourcePayload(input) {
  return {
    questionId: normalizeText(input.questionId),
    partLabel: normalizeText(input.partLabel),
    sharedStem: normalizeText(input.sharedStem),
    questionText: normalizeText(input.questionText),
    options: normalizeOptions(input.options),
    correctIndex: input.correctIndex == null || input.correctIndex === "" ? null : Number(input.correctIndex),
    marks: input.marks == null || input.marks === "" ? null : Number(input.marks),
    markScheme: normalizeMarkScheme(input.markScheme),
    subject: normalizeText(input.subject),
    examBoard: normalizeText(input.examBoard),
    level: normalizeText(input.level),
    tier: normalizeText(input.tier),
    topic: normalizeText(input.topic),
    topicKey: normalizeText(input.topicKey),
    imageContextText: normalizeText(input.imageContextText),
    currentExplanation: normalizeText(input.currentExplanation),
  };
}

/**
 * Stable JSON with sorted object keys (arrays keep order).
 * @param {unknown} value
 */
function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/**
 * @param {object} input
 * @returns {string} lowercase hex SHA-256
 */
function computeMcqRationaleSourceFingerprint(input) {
  const canonical = buildCanonicalSourcePayload(input || {});
  const json = stableStringify(canonical);
  return crypto.createHash("sha256").update(json, "utf8").digest("hex");
}

function buildGenerationGroupKey(questionId, partLabel, sourceFingerprint) {
  return `${normalizeText(questionId)}:${normalizeText(partLabel)}:${normalizeText(sourceFingerprint)}`;
}

module.exports = {
  normalizeText,
  normalizeOptions,
  normalizeMarkScheme,
  buildCanonicalSourcePayload,
  stableStringify,
  computeMcqRationaleSourceFingerprint,
  buildGenerationGroupKey,
};
