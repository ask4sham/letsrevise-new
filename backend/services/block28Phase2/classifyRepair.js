/**
 * Block 28 Phase 2 — conservative repair classification (read-only).
 */
const { normalizeMarkSchemeLines } = require("../../../lib/block28PracticePolicy");
const {
  REPAIR_CLASS,
  COMMAND_WORDS_ANALYTICAL,
  COMMAND_WORDS_RECALL,
} = require("./constants");

function extractCommandWord(question) {
  const text = String(question || "").trim().toLowerCase();
  for (const word of [...COMMAND_WORDS_ANALYTICAL, ...COMMAND_WORDS_RECALL]) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return word;
  }
  return null;
}

function hasCombinedBulletFlag(scheme) {
  const lines = normalizeMarkSchemeLines(scheme);
  return lines.some((line) => {
    const lower = line.toLowerCase();
    return (
      /\band\b/.test(lower) &&
      (/\b(because|so that|which|leading to|resulting in)\b/.test(lower) ||
        line.split(/\band\b/i).length > 2)
    );
  });
}

function hasAlternativeSeparationRisk(scheme) {
  const lines = normalizeMarkSchemeLines(scheme);
  return lines.some((line) => /\s+\/\s+|\s+or\s+/i.test(line));
}

function hasAmbiguityFlags(master) {
  const scheme = master.markSchemeRaw || master.markSchemeNormalized || master.markScheme || [];
  const flags = [];
  if (hasCombinedBulletFlag(scheme)) flags.push("combined_bullet");
  if (hasAlternativeSeparationRisk(scheme)) flags.push("alternative_in_scheme");
  const marks = Number(master.marks) || 0;
  const points = master.markSchemePointCount ?? normalizeMarkSchemeLines(scheme).length;
  if (marks >= 6 && points <= 3) flags.push("high_mark_low_scheme");
  if (!String(master.question || "").trim()) flags.push("empty_question");
  return flags;
}

/**
 * @param {object} master - manifest master record
 * @returns {{ classification: string, rule: string, confidence: number, reviewFlags: string[] }}
 */
function classifyP1Master(master) {
  const marks = Number(master.marks) || 0;
  const schemePoints =
    master.markSchemePointCount ?? normalizeMarkSchemeLines(master.markSchemeRaw).length;
  const question = String(master.question || "");
  const commandWord = extractCommandWord(question);
  const reviewFlags = hasAmbiguityFlags(master);

  if (!question.trim() || marks < 1) {
    return {
      classification: REPAIR_CLASS.NO_SAFE_PROPOSAL,
      rule: "missing_question_or_marks",
      confidence: 1,
      reviewFlags: [...reviewFlags, "missing_core_fields"],
    };
  }

  if (schemePoints === 0) {
    return {
      classification: REPAIR_CLASS.NO_SAFE_PROPOSAL,
      rule: "empty_mark_scheme",
      confidence: 0.95,
      reviewFlags,
    };
  }

  if (reviewFlags.includes("combined_bullet") || reviewFlags.includes("high_mark_low_scheme")) {
    return {
      classification: REPAIR_CLASS.REVIEW_QUESTION_AND_SCHEME,
      rule: "ambiguity_flags",
      confidence: 0.7,
      reviewFlags,
    };
  }

  const isRecall = commandWord && COMMAND_WORDS_RECALL.includes(commandWord);
  const isAnalytical = commandWord && COMMAND_WORDS_ANALYTICAL.includes(commandWord);

  if (isRecall && marks > schemePoints && marks >= 2) {
    return {
      classification: REPAIR_CLASS.REVIEW_MARK_VALUE,
      rule: "recall_inflated_marks",
      confidence: 0.75,
      reviewFlags,
    };
  }

  if (isAnalytical && marks >= 3 && marks > schemePoints && reviewFlags.length === 0) {
    return {
      classification: REPAIR_CLASS.REGENERATE_MARK_SCHEME,
      rule: "analytical_incomplete_scheme",
      confidence: 0.85,
      reviewFlags,
    };
  }

  if (marks > schemePoints && marks >= 3) {
    return {
      classification: REPAIR_CLASS.REGENERATE_MARK_SCHEME,
      rule: "default_incomplete_scheme",
      confidence: 0.7,
      reviewFlags,
    };
  }

  if (marks > schemePoints) {
    return {
      classification: REPAIR_CLASS.REVIEW_MARK_VALUE,
      rule: "low_marks_inflation",
      confidence: 0.65,
      reviewFlags,
    };
  }

  return {
    classification: REPAIR_CLASS.REVIEW_QUESTION_AND_SCHEME,
    rule: "unclassified_mismatch",
    confidence: 0.5,
    reviewFlags,
  };
}

function classifyManifestMasters(masters) {
  return masters.map((master) => {
    const result = classifyP1Master(master);
    return {
      ...master,
      repairClassification: result.classification,
      classificationEvidence: {
        rule: result.rule,
        confidence: result.confidence,
        reviewFlags: result.reviewFlags,
      },
    };
  });
}

module.exports = {
  classifyP1Master,
  classifyManifestMasters,
  extractCommandWord,
  hasCombinedBulletFlag,
  hasAlternativeSeparationRisk,
  hasAmbiguityFlags,
};
