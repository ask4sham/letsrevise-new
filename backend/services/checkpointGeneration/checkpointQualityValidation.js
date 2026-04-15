/**
 * Quality validation for AI-generated checkpoints (curriculum fit, duplication, safety, GCSE fit, etc.).
 * Runs after structural validation (validateCheckpointPayload.js).
 */

/** @typedef {import("./checkpointQualityValidation").QualityThresholds} QualityThresholds */
/** @typedef {import("./checkpointQualityValidation").CheckpointQualityResult} CheckpointQualityResult */

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "how",
  "why",
  "when",
  "where",
  "with",
  "from",
  "by",
  "about",
  "into",
  "than",
  "then",
  "not",
  "no",
  "yes",
  "your",
  "you",
  "we",
  "our",
]);

/** Rough safety / inappropriate patterns (block) */
const SAFETY_PATTERNS = [
  /\b(kill|suicide|self[\s-]?harm|terror)/i,
  /\b(porn|sexual\s+content)\b/i,
];

/** Phrases that are usually too informal or off-brief for GCSE stems */
const GCSE_INFORMAL = [/\blol\b/i, /\bstuff\b/i, /\bcool\b/i, /\bya know\b/i];

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function normaliseForDedup(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Overlap between checkpoint wording and lesson excerpt (curriculum relevance proxy).
 */
function curriculumOverlapScore(items, lessonText) {
  const lt = tokenize(lessonText);
  if (lt.length === 0) return 0.5;

  let scores = [];
  for (const it of items) {
    const bundle = [it.question, it.answer || "", ...(it.options || []), ...(it.markScheme || [])].join(" ");
    const q = tokenize(bundle);
    const j = jaccard(q, lt);
    scores.push(j);
  }
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function distinctOptionsScore(options) {
  const o = (options || []).map((x) => normaliseForDedup(x)).filter(Boolean);
  return new Set(o).size / Math.max(1, o.length);
}

function varietyScore(items) {
  if (items.length === 0) return 0;
  const mcq = items.filter((i) => i.type === "mcq").length;
  const ratio = mcq / items.length;
  const ideal = Math.abs(0.5 - ratio);
  return 1 - 2 * ideal;
}

function clarityPenalty(question) {
  const q = String(question || "");
  const len = q.length;
  let p = 0;
  if (len < 24) p += 0.4;
  if (len > 900) p += 0.25;
  if (q === q.toUpperCase() && len > 15) p += 0.35;
  return Math.min(1, p);
}

function safetyHits(text) {
  const hits = [];
  for (const re of SAFETY_PATTERNS) {
    if (re.test(text)) hits.push(re.toString());
  }
  return hits;
}

function gcseLanguageRisk(question) {
  for (const re of GCSE_INFORMAL) {
    if (re.test(question)) return 0.4;
  }
  return 0;
}

/**
 * shortExplain should be markable: markScheme lines or autoMark
 */
function shortMarkable(item) {
  const ms = Array.isArray(item.markScheme) ? item.markScheme : [];
  const hasMs = ms.some((s) => String(s).trim().length > 0);
  const hasAm = item.autoMark && typeof item.autoMark === "object" && Object.keys(item.autoMark).length > 0;
  const hasMarksHint = /\[\s*\d+\s*[Mm]ark|\d+\s*marks?\s*\]/i.test(item.question || "");
  return hasMs || hasAm || hasMarksHint;
}

/**
 * @param {object[]} items Normalised checkpoint items
 * @param {{ text: string }} extracted from extractLessonContent
 * @param {{ level?: string }} [meta]
 * @returns {CheckpointQualityResult}
 */
function validateCheckpointQuality(items, extracted, meta = {}) {
  const lessonText = String(extracted?.text || "");
  const issues = [];
  const failReasons = [];
  let critical = false;

  /** @type {import("./checkpointQualityValidation").DimensionScores} */
  const dimensionScores = {};

  /** Duplication */
  const seen = new Map();
  let duplicateFound = false;
  for (const it of items) {
    const key = normaliseForDedup(it.question);
    if (!key) continue;
    if (seen.has(key)) {
      duplicateFound = true;
      issues.push({
        severity: "error",
        code: "DUPLICATE_QUESTION",
        message: `Duplicate or near-duplicate question on page ${it.pageId}`,
        pageId: it.pageId,
      });
      failReasons.push("Duplicate question text in generated set");
      critical = true;
    } else {
      seen.set(key, true);
    }
  }
  dimensionScores.uniqueness = duplicateFound ? 0 : 1;

  /** Safety */
  let safetyFail = false;
  for (const it of items) {
    const blob = [it.question, ...(it.options || []), it.answer || ""].join(" ");
    const hits = safetyHits(blob);
    if (hits.length) {
      safetyFail = true;
      issues.push({
        severity: "error",
        code: "SAFETY_BLOCKLIST",
        message: "Safety filter triggered — item must not be published",
        pageId: it.pageId,
      });
      failReasons.push("Safety: blocked phrase in checkpoint content");
      critical = true;
    }
  }
  dimensionScores.safety = safetyFail ? 0 : 1;

  /** Curriculum relevance */
  const overlap = curriculumOverlapScore(items, lessonText);
  dimensionScores.curriculumRelevance = Math.min(1, overlap / 0.2);
  if (overlap < 0.06 && items.length > 0) {
    issues.push({
      severity: "warning",
      code: "LOW_CURRICULUM_OVERLAP",
      message: "Questions appear weakly grounded in lesson excerpt (lexical overlap)",
    });
    if (overlap < 0.03) {
      failReasons.push("Low alignment to lesson content (keywords from questions not found in lesson text)");
      critical = true;
    }
  }

  /** Answerability + formatting */
  let answerabilityParts = [];
  let formattingParts = [];
  for (const it of items) {
    if (it.type === "mcq") {
      const d = distinctOptionsScore(it.options);
      answerabilityParts.push(d);
      if (d < 0.75) {
        issues.push({
          severity: "warning",
          code: "MCQ_NON_DISTINCT_OPTIONS",
          message: "MCQ options may be too similar",
          pageId: it.pageId,
        });
      }
      if ((it.options || []).length !== 4) {
        formattingParts.push(0.7);
        issues.push({
          severity: "info",
          code: "FORMATTING_INCONSISTENT",
          message: "MCQ ideally has 4 options for GCSE-style consistency",
          pageId: it.pageId,
        });
      } else formattingParts.push(1);
    } else {
      const ok = shortMarkable(it);
      answerabilityParts.push(ok ? 1 : 0.6);
      if (!ok) {
        issues.push({
          severity: "warning",
          code: "SHORT_NOT_MARKABLE",
          message: "shortExplain should include markScheme or autoMark (or [N marks] in stem)",
          pageId: it.pageId,
        });
      }
      formattingParts.push(ok ? 1 : 0.5);
    }
  }
  dimensionScores.answerability =
    answerabilityParts.length === 0 ? 0 : answerabilityParts.reduce((a, b) => a + b, 0) / answerabilityParts.length;
  dimensionScores.formatting =
    formattingParts.length === 0 ? 1 : formattingParts.reduce((a, b) => a + b, 0) / formattingParts.length;

  /** Clarity */
  let claritySum = 0;
  for (const it of items) {
    const pen = clarityPenalty(it.question);
    claritySum += 1 - pen;
    if (pen >= 0.4) {
      issues.push({
        severity: "warning",
        code: it.question.length < 24 ? "CLARITY_TOO_SHORT" : "CLARITY_TOO_LONG",
        message: "Question length or casing may be unclear for students",
        pageId: it.pageId,
      });
    }
  }
  dimensionScores.clarity = items.length === 0 ? 0 : claritySum / items.length;

  /** GCSE language */
  let gcseR = 0;
  for (const it of items) {
    gcseR += 1 - gcseLanguageRisk(it.question);
  }
  dimensionScores.gcseFit = items.length === 0 ? 0 : gcseR / items.length;
  for (const it of items) {
    if (gcseLanguageRisk(it.question) > 0.2) {
      issues.push({
        severity: "warning",
        code: "GCSE_LANGUAGE_RISK",
        message: "Wording may be too informal for GCSE",
        pageId: it.pageId,
      });
    }
  }

  /** Variety */
  const v = varietyScore(items);
  dimensionScores.variety = v;
  if (items.length >= 3 && (v < 0.35 || mcqRatio(items) === 0 || mcqRatio(items) === 1)) {
    issues.push({
      severity: "warning",
      code: "VARIETY_LOW",
      message: "Mix MCQ and shortExplain across the set where possible",
    });
  }

  const weights = {
    curriculumRelevance: 0.22,
    uniqueness: 0.18,
    answerability: 0.18,
    gcseFit: 0.1,
    variety: 0.08,
    clarity: 0.1,
    safety: 0.12,
    formatting: 0.02,
  };

  let qualityScore = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = dimensionScores[k];
    qualityScore += (v != null ? v : 0) * w;
  }
  qualityScore = Math.max(0, Math.min(1, Number(qualityScore.toFixed(3))));

  const thresholds = getDefaultThresholds();
  const tier = tierFromScore(qualityScore, thresholds);
  /** Pass = eligible to leave "draft-only" and surface for review or better; blocked if critical or score in draft band */
  const passed = !critical && qualityScore >= thresholds.reviewMin;

  if (!passed && failReasons.length === 0) {
    failReasons.push(`Quality score ${qualityScore} below review threshold ${thresholds.reviewMin} or blocking checks failed`);
  }

  return {
    qualityScore,
    passed,
    failReasons: [...new Set(failReasons)],
    issues,
    dimensionScores,
    tier,
    thresholds,
  };
}

function mcqRatio(items) {
  if (!items.length) return 0;
  return items.filter((i) => i.type === "mcq").length / items.length;
}

function getDefaultThresholds() {
  return {
    reviewMin: parseFloat(process.env.CHECKPOINT_QUALITY_REVIEW_MIN || "0.55"),
    reviewMax: parseFloat(process.env.CHECKPOINT_QUALITY_REVIEW_MAX || "0.82"),
    autoPublishMin: parseFloat(process.env.CHECKPOINT_QUALITY_AUTO_PUBLISH_MIN || "0.82"),
  };
}

/**
 * @param {number} score
 * @param {QualityThresholds} t
 */
function tierFromScore(score, t) {
  if (score < t.reviewMin) return "draft";
  if (score < t.autoPublishMin) return "review";
  return "auto_publish";
}

/**
 * Combine structural (schema) score with quality score.
 * @param {number} structuralScore 0–1
 * @param {number} qualityScore 0–1
 * @param {{ structuralWeight?: number }} [opts]
 */
function combineScores(structuralScore, qualityScore, opts = {}) {
  const sw = opts.structuralWeight != null ? opts.structuralWeight : 0.35;
  const qw = 1 - sw;
  return Math.max(0, Math.min(1, Number((structuralScore * sw + qualityScore * qw).toFixed(3))));
}

module.exports = {
  validateCheckpointQuality,
  combineScores,
  getDefaultThresholds,
  /** @private export for tests */
  _test: { curriculumOverlapScore, normaliseForDedup },
};
