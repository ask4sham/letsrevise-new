/**
 * V2.2 read-only classification of Composite MCQ part rationales.
 * Does NOT apply V2.1 AI generation minimum-length rules to teacher content.
 * Pure — no DB, no LLM.
 *
 * GENERIC_PATTERN_SOURCES are the single source of truth for anchored generic
 * detection; the JS classifier and Mongo inventory aggregation both use them.
 */

const NEUTRAL_WHY_CORRECT = "The selected response matches the correct answer.";

const RATIONALE_BUCKETS = Object.freeze([
  "missing",
  "empty",
  "generic",
  "substantive",
  "malformed",
]);

/**
 * Anchored regex source strings (no leading/trailing slashes).
 * Used by JS RegExp and MongoDB $regexMatch.
 */
const GENERIC_PATTERN_SOURCES = Object.freeze({
  nonExplanation:
    "^(this\\s+is\\s+correct\\.?|it\\s+is\\s+(the\\s+)?(right|correct)\\s+answer\\.?|that\\s+is\\s+correct\\.?|correct\\.?|yes\\.?)$",
  awardMarks: "^award\\s+\\d+\\s+marks?\\b",
  nMarksFor: "^\\d+\\s+marks?\\s+for\\b",
  /** Mark-scheme only — not bare “Accepting …” scientific wording. */
  acceptMarkScheme: "^accept\\s+(?:answers?\\b|any\\b|either\\b|option\\b|[a-d]\\b)",
  doNotAccept: "^do\\s+not\\s+accept\\b",
  correctAnswerColon: "^correct\\s+answer\\s*:",
  selectOptionLetter: "^select(?:ing|ed)?\\s+(?:option\\s+)?[a-d]\\b",
  awardSelecting: "^award\\s+1\\s+mark\\s+for\\s+selecting\\b",
  optionLetterOnly: "^option\\s*[a-d]$",
  letterOnly: "^[a-d]$",
  labeledOption: "^(?:option\\s*)?([a-d])\\s*[—\\-–:]\\s*(.+)$",
  correctAnswerDeclared: "^correct\\s+answer\\s*:\\s*(?:[a-d]\\s*[—\\-–:]\\s*)?(.+)$",
  theAnswerIsLetter: "^the\\s+answer\\s+is\\s+(?:option\\s*)?[a-d]\\.?$",
});

const GENERIC_NON_EXPLANATION_RE = new RegExp(GENERIC_PATTERN_SOURCES.nonExplanation, "i");

function escapeRegex(text) {
  return String(text ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAdministrativeMarkingLine(text) {
  const t = normalizeText(text);
  if (!t) return true;
  return (
    new RegExp(GENERIC_PATTERN_SOURCES.awardMarks, "i").test(t) ||
    new RegExp(GENERIC_PATTERN_SOURCES.nMarksFor, "i").test(t) ||
    new RegExp(GENERIC_PATTERN_SOURCES.acceptMarkScheme, "i").test(t) ||
    new RegExp(GENERIC_PATTERN_SOURCES.doNotAccept, "i").test(t) ||
    new RegExp(GENERIC_PATTERN_SOURCES.correctAnswerColon, "i").test(t) ||
    new RegExp(GENERIC_PATTERN_SOURCES.selectOptionLetter, "i").test(t) ||
    new RegExp(GENERIC_PATTERN_SOURCES.awardSelecting, "i").test(t)
  );
}

function isBareCorrectOptionText(text, correctOption) {
  const t = normalizeText(text);
  if (!t) return true;
  const opt = normalizeText(correctOption || "");

  if (opt && t.toLowerCase() === opt.toLowerCase()) return true;
  if (new RegExp(GENERIC_PATTERN_SOURCES.optionLetterOnly, "i").test(t)) return true;
  if (new RegExp(GENERIC_PATTERN_SOURCES.letterOnly, "i").test(t)) return true;

  const labeled = t.match(new RegExp(GENERIC_PATTERN_SOURCES.labeledOption, "i"));
  if (labeled) {
    const rest = normalizeText(labeled[2] || "");
    if (!rest) return true;
    if (opt && rest.toLowerCase() === opt.toLowerCase()) return true;
  }

  const declared = t.match(new RegExp(GENERIC_PATTERN_SOURCES.correctAnswerDeclared, "i"));
  if (declared) {
    const rest = normalizeText(declared[1] || "");
    if (!rest) return true;
    if (opt && rest.toLowerCase() === opt.toLowerCase()) return true;
    if (new RegExp(GENERIC_PATTERN_SOURCES.letterOnly, "i").test(rest)) return true;
    if (new RegExp(GENERIC_PATTERN_SOURCES.optionLetterOnly, "i").test(rest)) return true;
  }

  if (opt) {
    const esc = escapeRegex(opt);
    if (new RegExp(`^this\\s+is\\s+correct\\s+because\\s+it\\s+is\\s+${esc}\\.?$`, "i").test(t)) {
      return true;
    }
  }
  if (new RegExp(GENERIC_PATTERN_SOURCES.theAnswerIsLetter, "i").test(t)) return true;

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

/**
 * MongoDB classification stages for an unwound `parts` MCQ document.
 * Uses GENERIC_PATTERN_SOURCES — no $function / server-side JS.
 * @returns {object[]} aggregation stages
 */
function buildMongoMcqClassificationFields() {
  const P = GENERIC_PATTERN_SOURCES;
  const trimStr = (expr) => ({
    $trim: {
      input: {
        $convert: { input: expr, to: "string", onError: "", onNull: "" },
      },
    },
  });

  const regexMatch = (input, source) => ({
    $regexMatch: { input, regex: source, options: "i" },
  });

  const subjectTrim = trimStr("$subject");
  const topicTrim = trimStr("$topic");
  const topicKeyTrim = trimStr("$topicKey");

  return [
    {
      $addFields: {
        _optionsTrimmed: {
          $cond: [
            { $isArray: "$parts.options" },
            {
              $map: {
                input: "$parts.options",
                as: "o",
                in: trimStr("$$o"),
              },
            },
            null,
          ],
        },
        _questionTextTrimmed: trimStr("$parts.questionText"),
        _partLabelTrimmed: trimStr("$parts.label"),
        _correctIndexNum: {
          $convert: { input: "$parts.correctIndex", to: "int", onError: -1, onNull: -1 },
        },
        _explanationType: { $type: "$parts.partData.explanation" },
        _partDataType: { $type: "$parts.partData" },
      },
    },
    {
      $addFields: {
        _usableOptions: {
          $filter: {
            input: { $ifNull: ["$_optionsTrimmed", []] },
            as: "o",
            cond: { $gt: [{ $strLenCP: "$$o" }, 0] },
          },
        },
      },
    },
    {
      $addFields: {
        _structureOk: {
          $and: [
            { $isArray: "$_optionsTrimmed" },
            { $gte: [{ $size: "$_usableOptions" }, 2] },
            { $gt: [{ $strLenCP: "$_questionTextTrimmed" }, 0] },
            { $gte: ["$_correctIndexNum", 0] },
            { $lt: ["$_correctIndexNum", { $size: "$_optionsTrimmed" }] },
            {
              $gt: [
                {
                  $strLenCP: {
                    $ifNull: [{ $arrayElemAt: ["$_optionsTrimmed", "$_correctIndexNum"] }, ""],
                  },
                },
                0,
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        _correctOption: {
          $cond: [
            "$_structureOk",
            { $arrayElemAt: ["$_optionsTrimmed", "$_correctIndexNum"] },
            null,
          ],
        },
        _explanationTrimmed: {
          $cond: [
            { $eq: ["$_explanationType", "string"] },
            { $trim: { input: "$parts.partData.explanation" } },
            "",
          ],
        },
      },
    },
    {
      $addFields: {
        _labeledFind: {
          $regexFind: {
            input: "$_explanationTrimmed",
            regex: P.labeledOption,
            options: "i",
          },
        },
      },
    },
    {
      $addFields: {
        rationaleBucket: {
          $switch: {
            branches: [
              { case: { $not: ["$_structureOk"] }, then: "malformed" },
              {
                case: {
                  $or: [
                    { $eq: ["$_partDataType", "missing"] },
                    { $eq: ["$_partDataType", "null"] },
                    { $eq: ["$_partDataType", "array"] },
                    { $ne: ["$_partDataType", "object"] },
                  ],
                },
                then: "missing",
              },
              {
                case: {
                  $or: [
                    { $eq: ["$_explanationType", "missing"] },
                    { $eq: ["$_explanationType", "null"] },
                  ],
                },
                then: "missing",
              },
              {
                case: { $ne: ["$_explanationType", "string"] },
                then: "malformed",
              },
              {
                case: { $eq: [{ $strLenCP: "$_explanationTrimmed" }, 0] },
                then: "empty",
              },
              {
                case: {
                  $or: [
                    {
                      $eq: [
                        { $toLower: "$_explanationTrimmed" },
                        NEUTRAL_WHY_CORRECT.toLowerCase(),
                      ],
                    },
                    regexMatch("$_explanationTrimmed", P.nonExplanation),
                    regexMatch("$_explanationTrimmed", P.awardMarks),
                    regexMatch("$_explanationTrimmed", P.nMarksFor),
                    regexMatch("$_explanationTrimmed", P.acceptMarkScheme),
                    regexMatch("$_explanationTrimmed", P.doNotAccept),
                    regexMatch("$_explanationTrimmed", P.correctAnswerColon),
                    regexMatch("$_explanationTrimmed", P.selectOptionLetter),
                    regexMatch("$_explanationTrimmed", P.awardSelecting),
                    {
                      $and: [
                        { $ne: ["$_correctOption", null] },
                        {
                          $eq: [
                            { $toLower: "$_explanationTrimmed" },
                            { $toLower: "$_correctOption" },
                          ],
                        },
                      ],
                    },
                    regexMatch("$_explanationTrimmed", P.optionLetterOnly),
                    regexMatch("$_explanationTrimmed", P.letterOnly),
                    regexMatch("$_explanationTrimmed", P.theAnswerIsLetter),
                    {
                      $and: [
                        { $ne: ["$_labeledFind", null] },
                        {
                          $eq: [
                            {
                              $strLenCP: {
                                $trim: {
                                  input: {
                                    $ifNull: [
                                      { $arrayElemAt: ["$_labeledFind.captures", 1] },
                                      "",
                                    ],
                                  },
                                },
                              },
                            },
                            0,
                          ],
                        },
                      ],
                    },
                    {
                      $and: [
                        { $ne: ["$_labeledFind", null] },
                        { $ne: ["$_correctOption", null] },
                        {
                          $eq: [
                            {
                              $toLower: {
                                $trim: {
                                  input: {
                                    $ifNull: [
                                      { $arrayElemAt: ["$_labeledFind.captures", 1] },
                                      "",
                                    ],
                                  },
                                },
                              },
                            },
                            { $toLower: "$_correctOption" },
                          ],
                        },
                      ],
                    },
                    {
                      $and: [
                        { $ne: ["$_correctOption", null] },
                        {
                          $regexMatch: {
                            input: "$_explanationTrimmed",
                            regex: {
                              $concat: [
                                "^this\\s+is\\s+correct\\s+because\\s+it\\s+is\\s+",
                                {
                                  $replaceAll: {
                                    input: {
                                      $replaceAll: {
                                        input: {
                                          $replaceAll: {
                                            input: {
                                              $replaceAll: {
                                                input: "$_correctOption",
                                                find: "\\",
                                                replacement: "\\\\",
                                              },
                                            },
                                            find: ".",
                                            replacement: "\\.",
                                          },
                                        },
                                        find: "(",
                                        replacement: "\\(",
                                      },
                                    },
                                    find: ")",
                                    replacement: "\\)",
                                  },
                                },
                                "\\.?$",
                              ],
                            },
                            options: "i",
                          },
                        },
                      ],
                    },
                  ],
                },
                then: "generic",
              },
            ],
            default: "substantive",
          },
        },
      },
    },
    {
      $addFields: {
        potentiallyEligibleForBackfill: {
          $and: [
            { $ne: [{ $ifNull: ["$isArchived", false] }, true] },
            { $gt: [{ $strLenCP: subjectTrim }, 0] },
            {
              $or: [
                { $gt: [{ $strLenCP: topicKeyTrim }, 0] },
                { $gt: [{ $strLenCP: topicTrim }, 0] },
              ],
            },
            { $in: ["$rationaleBucket", ["missing", "empty", "generic"]] },
          ],
        },
        statusDisplay: {
          $cond: [
            { $eq: [{ $ifNull: ["$isArchived", false] }, true] },
            "archived",
            { $ifNull: ["$status", null] },
          ],
        },
        invOptions: { $cond: ["$_structureOk", "$_optionsTrimmed", []] },
        invCorrectIndex: { $cond: ["$_structureOk", "$_correctIndexNum", null] },
        invCorrectOption: { $cond: ["$_structureOk", "$_correctOption", null] },
        invQuestionText: "$_questionTextTrimmed",
        invPartLabel: {
          $cond: [{ $gt: [{ $strLenCP: "$_partLabelTrimmed" }, 0] }, "$_partLabelTrimmed", "?"],
        },
        invExplanation: {
          $switch: {
            branches: [
              { case: { $in: ["$rationaleBucket", ["missing", "malformed"]] }, then: null },
              {
                case: { $eq: ["$rationaleBucket", "empty"] },
                then: { $ifNull: ["$parts.partData.explanation", ""] },
              },
            ],
            default: "$_explanationTrimmed",
          },
        },
        invMarkScheme: {
          $cond: [
            { $isArray: "$parts.markScheme" },
            {
              $filter: {
                input: {
                  $map: {
                    input: "$parts.markScheme",
                    as: "l",
                    in: trimStr("$$l"),
                  },
                },
                as: "l",
                cond: { $gt: [{ $strLenCP: "$$l" }, 0] },
              },
            },
            [],
          ],
        },
      },
    },
  ];
}

module.exports = {
  RATIONALE_BUCKETS,
  NEUTRAL_WHY_CORRECT,
  GENERIC_PATTERN_SOURCES,
  classifyCompositeMcqPart,
  validateMcqPartStructure,
  isGenericRationaleText,
  isAdministrativeMarkingLine,
  isBareCorrectOptionText,
  normalizeText,
  escapeRegex,
  buildMongoMcqClassificationFields,
};
