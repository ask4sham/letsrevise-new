/**
 * Keyword-bank auto-marking for short-answer / explain checkpoints (GCSE, conservative).
 * Pure functions — safe to call from routes, workers, or tests.
 */

/** @typedef {'correct' | 'partial' | 'incorrect'} AutoMarkVerdict */

/**
 * @typedef {Object} CheckpointAutoMarkBank
 * @property {string} [canonicalAnswer]
 * @property {string[]} [requiredKeywords]
 * @property {string[]} [optionalKeywords]
 * @property {string[]} [forbiddenMisconceptions]
 * @property {string[]} [acceptedVariants]
 * @property {number} [minMatchThreshold] 0–1, default 0.6
 */

/**
 * @typedef {Object} AutoMarkResult
 * @property {AutoMarkVerdict} verdict
 * @property {string[]} matchedRequired
 * @property {string[]} missingRequired
 * @property {string[]} matchedOptional
 * @property {string[]} misconceptionHits
 * @property {string} feedback
 * @property {number} requiredRatio 0–1
 */

const DEFAULT_THRESHOLD = 0.6;

/**
 * @param {string} s
 * @returns {string}
 */
function normalizeForMatch(s) {
  if (!s || typeof s !== "string") return "";
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9%+\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Conservative match: substring in hay, or word-level match including common English plurals
 * (e.g. artery/arteries, muscle/muscles) via shared 5-char stem when the keyword is long enough.
 * @param {string} studentRaw
 * @param {string} phraseRaw
 */
function keywordMatched(studentRaw, phraseRaw) {
  const hay = normalizeForMatch(studentRaw);
  const needle = normalizeForMatch(phraseRaw);
  if (!needle) return false;
  if (hay.includes(needle)) return true;
  if (needle.length < 3) return false;
  const words = hay.split(/\s+/).filter(Boolean);
  const stem = needle.length >= 5 ? needle.slice(0, 5) : needle;
  for (const w of words) {
    if (w.length < 3) continue;
    if (w.startsWith(needle) || needle.startsWith(w)) {
      if (Math.abs(w.length - needle.length) <= 4) return true;
    }
    if (needle.length >= 5 && w.startsWith(stem) && Math.abs(w.length - needle.length) <= 5) {
      return true;
    }
  }
  return false;
}

/**
 * @param {CheckpointAutoMarkBank} bank
 * @returns {CheckpointAutoMarkBank}
 */
function normalizeBank(bank) {
  if (!bank || typeof bank !== "object") {
    return {
      canonicalAnswer: "",
      requiredKeywords: [],
      optionalKeywords: [],
      forbiddenMisconceptions: [],
      acceptedVariants: [],
      minMatchThreshold: DEFAULT_THRESHOLD,
    };
  }
  const clamp = (n, def, lo, hi) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return def;
    return Math.max(lo, Math.min(hi, x));
  };
  const strArr = (a, maxLen, maxItems) => {
    if (!Array.isArray(a)) return [];
    return a
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, maxItems)
      .map((s) => s.slice(0, maxLen));
  };
  return {
    canonicalAnswer: typeof bank.canonicalAnswer === "string" ? bank.canonicalAnswer.trim().slice(0, 4000) : "",
    requiredKeywords: strArr(bank.requiredKeywords, 120, 40),
    optionalKeywords: strArr(bank.optionalKeywords, 120, 40),
    forbiddenMisconceptions: strArr(bank.forbiddenMisconceptions, 200, 30),
    acceptedVariants: strArr(bank.acceptedVariants, 2000, 25),
    minMatchThreshold: clamp(bank.minMatchThreshold, DEFAULT_THRESHOLD, 0, 1),
  };
}

/**
 * @param {string} studentRaw
 * @param {CheckpointAutoMarkBank} bankNorm
 */
function variantOrCanonicalMatch(studentRaw, bankNorm) {
  const s = normalizeForMatch(studentRaw);
  if (!s) return false;
  if (bankNorm.canonicalAnswer) {
    const c = normalizeForMatch(bankNorm.canonicalAnswer);
    if (c.length >= 4 && s.includes(c)) return true;
  }
  for (const v of bankNorm.acceptedVariants) {
    const nv = normalizeForMatch(v);
    if (nv.length >= 4 && s.includes(nv)) return true;
  }
  return false;
}

/**
 * @param {string} studentAnswer
 * @param {CheckpointAutoMarkBank} bankIn
 * @returns {AutoMarkResult}
 */
function autoMarkShortAnswer(studentAnswer, bankIn) {
  const bank = normalizeBank(bankIn);
  const student = typeof studentAnswer === "string" ? studentAnswer : "";

  const matchedRequired = [];
  const missingRequired = [];
  const matchedOptional = [];
  const misconceptionHits = [];

  for (const phrase of bank.forbiddenMisconceptions) {
    if (keywordMatched(student, phrase)) misconceptionHits.push(phrase);
  }

  if (misconceptionHits.length > 0) {
    return {
      verdict: "incorrect",
      matchedRequired: [],
      missingRequired: [...bank.requiredKeywords],
      matchedOptional: [],
      misconceptionHits,
      feedback:
        "This answer includes an idea we are steering away from for this question. Check the lesson and try again.",
      requiredRatio: 0,
    };
  }

  for (const kw of bank.requiredKeywords) {
    if (keywordMatched(student, kw)) matchedRequired.push(kw);
    else missingRequired.push(kw);
  }
  for (const kw of bank.optionalKeywords) {
    if (keywordMatched(student, kw)) matchedOptional.push(kw);
  }

  const req = bank.requiredKeywords;
  const thr = bank.minMatchThreshold;
  const variantHit = variantOrCanonicalMatch(student, bank);

  if (req.length === 0) {
    if (variantHit) {
      return {
        verdict: "correct",
        matchedRequired: [],
        missingRequired: [],
        matchedOptional,
        misconceptionHits,
        feedback: buildFeedback([], [], matchedOptional, "correct"),
        requiredRatio: 1,
      };
    }
    if (matchedOptional.length > 0) {
      return {
        verdict: "partial",
        matchedRequired: [],
        missingRequired: [],
        matchedOptional,
        misconceptionHits,
        feedback: buildFeedback([], [], matchedOptional, "partial"),
        requiredRatio: 0.5,
      };
    }
    return {
      verdict: "incorrect",
      matchedRequired: [],
      missingRequired: [],
      matchedOptional: [],
      misconceptionHits,
      feedback:
        "Use ideas from this topic to answer. Compare your answer with the lesson summary and try again.",
      requiredRatio: 0,
    };
  }

  const requiredRatio = matchedRequired.length / req.length;

  if (requiredRatio >= 1 - 1e-9) {
    return {
      verdict: "correct",
      matchedRequired,
      missingRequired: [],
      matchedOptional,
      misconceptionHits,
      feedback: buildFeedback(matchedRequired, [], matchedOptional, "correct"),
      requiredRatio: 1,
    };
  }

  if (requiredRatio >= thr) {
    return {
      verdict: "partial",
      matchedRequired,
      missingRequired,
      matchedOptional,
      misconceptionHits,
      feedback: buildFeedback(matchedRequired, missingRequired, matchedOptional, "partial"),
      requiredRatio,
    };
  }

  if (variantHit) {
    return {
      verdict: "partial",
      matchedRequired,
      missingRequired,
      matchedOptional,
      misconceptionHits,
      feedback:
        "You are close to the model answer — add the missing key terms for full credit.",
      requiredRatio,
    };
  }

  return {
    verdict: "incorrect",
    matchedRequired,
    missingRequired,
    matchedOptional,
    misconceptionHits,
    feedback: buildFeedback(matchedRequired, missingRequired, matchedOptional, "incorrect"),
    requiredRatio,
  };
}

/**
 * @param {string[]} matchedRequired
 * @param {string[]} missingRequired
 * @param {string[]} matchedOptional
 * @param {'correct'|'partial'|'incorrect'} tone
 */
function buildFeedback(matchedRequired, missingRequired, matchedOptional, tone) {
  const parts = [];
  if (matchedRequired.length) parts.push(`You used: ${matchedRequired.join("; ")}.`);
  if (missingRequired.length && tone !== "correct") {
    parts.push(`Try to also include: ${missingRequired.join("; ")}.`);
  }
  if (matchedOptional.length) parts.push(`Good extra detail: ${matchedOptional.join("; ")}.`);
  if (tone === "incorrect" && !parts.length) {
    parts.push("Review the relevant section and include the key terms expected for full credit.");
  }
  return parts.join(" ").trim() || "Keep going — check the lesson for key terms.";
}

module.exports = {
  autoMarkShortAnswer,
  normalizeForMatch,
  normalizeBank,
  keywordMatched,
  DEFAULT_THRESHOLD,
};
