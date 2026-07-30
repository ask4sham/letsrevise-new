/**
 * V2.2 read-only classification of Composite MCQ part rationales.
 * Does NOT apply V2.1 AI generation minimum-length rules to teacher content.
 * Pure — no DB, no LLM.
 */

const NEUTRAL_WHY_CORRECT = "The selected response matches the correct answer.";

const RATIONALE_BUCKETS = Object.freeze([
  "missing",
  "empty",
  "generic",
  "substantive",
  "malformed",
]);

const GENERIC_NON_EXPLANATION_RE =
  /^(this\s+is\s+correct\.?|it\s+is\s+(the\s+)?(right|correct)\s+answer\.?|that\s+is\s+correct\.?|correct\.?|yes\.?)$/i;

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAdministrativeMarkingLine(text) {
  const t = normalizeText(text);
  if (!t) return true;
  return (
    /^award\s+\d+\s+marks?\b/i.test(t) ||
    /^\d+\s+marks?\s+for\b/i.test(t) ||
    /^accept\b/i.test(t) ||
    /^do\s+not\s+accept\b/i.test(t) ||
    /^correct\s+answer\s*:/i.test(t) ||
    /^select(?:ing|ed)?\s+(?:option\s+)?[a-d]\b/i.test(t) ||
    /^award\s+1\s+mark\s+for\s+selecting\b/i.test(t)
  );
}

function isBareCorrectOptionText(text, correctOption) {
  const t = normalizeText(text);
  if (!t) return true;
  const opt = normalizeText(correctOption || "");

  if (opt && t.toLowerCase() === opt.toLowerCase()) return true;
  if (/^option\s*[a-d]$/i.test(t) || /^[a-d]$/i.test(t)) return true;

  const labeled = t.match(/^(?:option\s*)?([a-d])\s*[—\-–:]\s*(.+)$/i);
  if (labeled) {
    const rest = normalizeText(labeled[2] || "");
    if (!rest) return true;
    if (opt && rest.toLowerCase() === opt.toLowerCase()) return true;
  }

  const declared = t.match(/^correct\s+answer\s*:\s*(?:[a-d]\s*[—\-–:]\s*)?(.+)$/i);
  if (declared) {
    const rest = normalizeText(declared[1] || "");
    if (!rest) return true;
    if (opt && rest.toLowerCase() === opt.toLowerCase()) return true;
    if (/^[a-d]$/i.test(rest) || /^option\s*[a-d]$/i.test(rest)) return true;
  }

  if (opt) {
    const esc = opt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`^this\\s+is\\s+correct\\s+because\\s+it\\s+is\\s+${esc}\\.?$`, "i").test(t)) {
      return true;
    }
  }
  if (/^the\s+answer\s+is\s+(?:option\s*)?[a-d]\.?$/i.test(t)) return true;

  return false;
}

function isGenericRationaleText(text, correctOption) {
  const t = normalizeText(text);
  if (!t) return false;
  if (t.toLowerCase() === NEUTRAL_WHY_CORRECT.toLowerCase()) return true;
  if (GENERIC_NON_EXPLANATION_RE.test(t)) return true;
  if (isAdministrativeMarkingLine(t)) return true;
  if (isBareCorrectOptionText(t, correctOption)) return true;
  return false;
}

/**
 * @param {unknown} part
 * @returns {{ ok: false, reason: string } | { ok: true, options: string[], correctIndex: number, correctOption: string, questionText: string, label: string }}
 */
function validateMcqPartStructure(part) {
  if (!part || typeof part !== "object" || Array.isArray(part)) {
    return { ok: false, reason: "part_not_object" };
  }
  const type = String(part.type || "")
    .trim()
    .toLowerCase();
  if (type !== "mcq") {
    return { ok: false, reason: "not_mcq" };
  }
  const questionText = String(part.questionText || "").trim();
  if (!questionText) {
    return { ok: false, reason: "question_text_missing" };
  }
  if (!Array.isArray(part.options)) {
    return { ok: false, reason: "options_not_array" };
  }
  const options = part.options.map((o) => String(o || "").trim());
  const usable = options.filter((o) => o.length > 0);
  if (usable.length < 2) {
    return { ok: false, reason: "options_insufficient" };
  }
  const ci = Number(part.correctIndex);
  if (!Number.isInteger(ci) || ci < 0 || ci >= options.length || !options[ci]) {
    return { ok: false, reason: "correct_index_invalid" };
  }
  return {
    ok: true,
    options,
    correctIndex: ci,
    correctOption: options[ci],
    questionText,
    label: String(part.label || "").trim(),
  };
}

/**
 * Classify one Composite MCQ part into exactly one rationale bucket.
 * @param {unknown} part
 * @param {{ isArchived?: boolean, subject?: string, topic?: string, topicKey?: string }} [ctx]
 * @returns {{
 *   bucket: string,
 *   explanation: string | null,
 *   potentiallyEligibleForBackfill: boolean,
 *   correctOption: string | null,
 *   options: string[],
 *   correctIndex: number | null,
 *   questionText: string,
 *   label: string,
 *   structureReason?: string,
 * }}
 */
function classifyCompositeMcqPart(part, ctx = {}) {
  const structure = validateMcqPartStructure(part);
  if (!structure.ok) {
    return {
      bucket: "malformed",
      explanation: null,
      potentiallyEligibleForBackfill: false,
      correctOption: null,
      options: [],
      correctIndex: null,
      questionText: part && typeof part === "object" ? String(part.questionText || "") : "",
      label: part && typeof part === "object" ? String(part.label || "").trim() : "",
      structureReason: structure.reason,
    };
  }

  const partData = part.partData;
  let rawExplanation;
  if (partData == null || typeof partData !== "object" || Array.isArray(partData)) {
    rawExplanation = undefined;
  } else if (!Object.prototype.hasOwnProperty.call(partData, "explanation")) {
    rawExplanation = undefined;
  } else {
    rawExplanation = partData.explanation;
  }

  let bucket;
  /** @type {string | null} */
  let explanation = null;

  if (rawExplanation === undefined || rawExplanation === null) {
    bucket = "missing";
  } else if (typeof rawExplanation !== "string") {
    // Non-string explanation is not usable teacher text — treat as malformed for backfill safety.
    return {
      bucket: "malformed",
      explanation: null,
      potentiallyEligibleForBackfill: false,
      correctOption: structure.correctOption,
      options: structure.options,
      correctIndex: structure.correctIndex,
      questionText: structure.questionText,
      label: structure.label,
      structureReason: "explanation_not_string",
    };
  } else {
    const trimmed = rawExplanation.trim();
    explanation = rawExplanation;
    if (!trimmed) {
      bucket = "empty";
    } else if (isGenericRationaleText(trimmed, structure.correctOption)) {
      bucket = "generic";
      explanation = trimmed;
    } else {
      bucket = "substantive";
      explanation = trimmed;
    }
  }

  const archived = Boolean(ctx.isArchived);
  const hasContext =
    Boolean(String(ctx.subject || "").trim()) &&
    Boolean(String(ctx.topicKey || ctx.topic || "").trim());

  const potentiallyEligibleForBackfill =
    !archived &&
    hasContext &&
    (bucket === "missing" || bucket === "empty" || bucket === "generic");

  return {
    bucket,
    explanation,
    potentiallyEligibleForBackfill,
    correctOption: structure.correctOption,
    options: structure.options,
    correctIndex: structure.correctIndex,
    questionText: structure.questionText,
    label: structure.label,
  };
}

module.exports = {
  RATIONALE_BUCKETS,
  NEUTRAL_WHY_CORRECT,
  classifyCompositeMcqPart,
  validateMcqPartStructure,
  isGenericRationaleText,
  isAdministrativeMarkingLine,
  isBareCorrectOptionText,
  normalizeText,
};
