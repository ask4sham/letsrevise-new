/**
 * LetsRevise Lesson Quality Scoring System v1.0
 *
 * Evaluates teaching quality for both AI-generated and manually created lessons.
 * Sits on top of curriculum and structure validation.
 *
 * Bands: 0-39 poor, 40-54 weak, 55-69 acceptable, 70-84 strong, 85-100 publish-ready
 * Weights: structure=20, pedagogy=25, examReadiness=20, clarity=15, completeness=20
 *
 * @typedef {Object} LessonQualityResult
 * @property {number} score - 0-100
 * @property {"poor"|"weak"|"acceptable"|"strong"|"publish-ready"} band
 * @property {boolean} passed
 * @property {{ structure: number; pedagogy: number; examReadiness: number; clarity: number; completeness: number }} categories
 * @property {string[]} issues
 * @property {string[]} suggestions
 */

const { validateLessonStructure } = require("../services/lessonDraftValidation");

// STEP 3 — Quality bands (hardcoded)
const BAND_THRESHOLDS = [
  [0, 39, "poor"],
  [40, 54, "weak"],
  [55, 69, "acceptable"],
  [70, 84, "strong"],
  [85, 100, "publish-ready"],
];

// STEP 4 — Category weights (total = 100)
const CATEGORY_WEIGHTS = {
  structure: 20,
  pedagogy: 25,
  examReadiness: 20,
  clarity: 15,
  completeness: 20,
};

function safeStr(v, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  const t = typeof s.trim === "function" ? s.trim() : s;
  return t && t.length ? t : fallback;
}

function getBlocks(lesson) {
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  return pages.flatMap((p) => p?.blocks ?? []);
}

function extractText(lesson) {
  const parts = [];
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  for (const p of pages) {
    for (const b of p?.blocks ?? []) {
      const c = safeStr(b?.content, "");
      const pr = safeStr(b?.prompt, "");
      const ex = safeStr(b?.explanation, "");
      if (c) parts.push(c);
      if (pr) parts.push(pr);
      if (ex) parts.push(ex);
    }
    const q = p?.checkpoint?.question;
    if (q) parts.push(safeStr(q, ""));
  }
  return parts.join(" ");
}

function hasRole(blocks, role) {
  return blocks.some((b) => safeStr(b?.role, "") === role);
}

function workedExampleContent(b) {
  return [b?.explanation, b?.correctAnswer, b?.prompt, b?.answer].filter(Boolean).map(String).join(" ");
}

/**
 * STEP 10 — getLessonQualityBand(score)
 * 0-39 = poor, 40-54 = weak, 55-69 = acceptable, 70-84 = strong, 85-100 = publish-ready
 */
function getLessonQualityBand(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  for (const [min, max, band] of BAND_THRESHOLDS) {
    if (s >= min && s <= max) return band;
  }
  return s >= 85 ? "publish-ready" : "poor";
}

/**
 * STEP 5 — Structure scoring (max 20)
 * Starts at 20. Deduct for missing elements and structure errors.
 */
function scoreStructure(lesson, context) {
  const structureIssues = context?.structureIssues ?? validateLessonStructure(lesson);
  const blocks = getBlocks(lesson);
  let score = CATEGORY_WEIGHTS.structure;

  // Structure errors — fall sharply
  if (structureIssues.length > 0) {
    score -= Math.min(15, structureIssues.length * 3);
  }
  if (!hasRole(blocks, "hook")) score -= 3;
  if (!hasRole(blocks, "workedExample")) score -= 4;
  if (!hasRole(blocks, "finalMemoryRule")) score -= 3;
  if (!hasRole(blocks, "whatToNotice")) score -= 3;

  const diagramCount = blocks.filter((b) => safeStr(b?.type, "") === "diagram").length;
  if (diagramCount < 1) score -= 3;
  if (diagramCount < 2) score -= 2;

  const checkpointCount = blocks.filter((b) => safeStr(b?.type, "") === "checkpoint").length;
  if (checkpointCount < 1) score -= 4;

  const roles = new Set(blocks.map((b) => safeStr(b?.role, "")).filter(Boolean));
  const required = ["hook", "coreRule", "commonMistake", "patternRecognition", "workedExample", "synthesis", "finalMemoryRule"];
  const missing = required.filter((r) => !roles.has(r));
  if (missing.length) score -= Math.min(6, missing.length * 2);

  const hasConceptLoop = hasRole(blocks, "whatToNotice") && diagramCount >= 1;
  if (!hasConceptLoop) score -= 2;

  return Math.max(0, Math.min(CATEGORY_WEIGHTS.structure, score));
}

/**
 * STEP 6 — Pedagogy scoring (max 25)
 * Punish note-dumping. Reward guided explanations.
 */
function scorePedagogy(lesson) {
  const blocks = getBlocks(lesson);
  const text = extractText(lesson).toLowerCase();
  let score = CATEGORY_WEIGHTS.pedagogy;

  if (!hasRole(blocks, "coreRule")) score -= 5;
  if (!hasRole(blocks, "commonMistake")) score -= 4;
  if (!hasRole(blocks, "patternRecognition")) score -= 3;
  if (!hasRole(blocks, "synthesis")) score -= 3;
  if (!hasRole(blocks, "whatToNotice")) score -= 2;

  const hookBlocks = blocks.filter((b) => safeStr(b?.role, "") === "hook");
  const meaningfulHook = hookBlocks.some((b) => (b?.content || "").toString().trim().length > 20);
  if (!meaningfulHook) score -= 2;

  const vaguePhrases = [
    /helps?\s+(the\s+)?(cell|cell['\u2019s]?)\s+do\s+its?\s+job/i,
    /important\s+for\s+(the\s+)?function/i,
    /used\s+for\s+many\s+things?/i,
    /plays?\s+an?\s+(important\s+)?role/i,
    /essential\s+for\s+(the\s+)?(cell|process)/i,
  ];
  const vagueCount = vaguePhrases.filter((re) => re.test(text)).length;
  if (vagueCount >= 2) score -= 3;
  if (vagueCount >= 4) score -= 2;

  const hasGuidedExplanation = /\b(because|so\s+that|this\s+means|which\s+allows?|enables?)\b/i.test(text);
  if (!hasGuidedExplanation) score -= 2;

  return Math.max(0, Math.min(CATEGORY_WEIGHTS.pedagogy, score));
}

/**
 * STEP 7 — ExamReadiness scoring (max 20)
 * Command words: Explain, Describe, Compare. Deduct heavily for missing worked example.
 */
function scoreExamReadiness(lesson) {
  const blocks = getBlocks(lesson);
  const text = extractText(lesson);
  const textLower = text.toLowerCase();
  let score = CATEGORY_WEIGHTS.examReadiness;

  const hasWorkedExample = blocks.some((b) => safeStr(b?.role, "") === "workedExample" && workedExampleContent(b).length > 30);
  if (!hasWorkedExample) score -= 8;
  const hasModelAnswer = blocks.some((b) => {
    const ex = safeStr(b?.explanation, "");
    return ex.length > 40;
  });
  if (!hasModelAnswer && hasWorkedExample) score -= 3;

  const examTipCount = blocks.filter((b) =>
    ["examTip", "examTips"].includes(safeStr(b?.type, ""))
  ).length;
  if (examTipCount < 1) score -= 4;
  if (examTipCount < 2) score -= 2;

  const checkpointBlocks = blocks.filter((b) => safeStr(b?.type, "") === "checkpoint");
  const examStyleCheckpoints = checkpointBlocks.filter((b) => {
    const p = (safeStr(b?.prompt, "") || safeStr(b?.question, "")).toLowerCase();
    return /explain|describe|compare|evaluate|suggest/.test(p) && p.length >= 15;
  });
  if (examStyleCheckpoints.length < 1) score -= 4;
  if (checkpointBlocks.length < 2) score -= 2;

  const onlyRecall = checkpointBlocks.length > 0 && examStyleCheckpoints.length === 0;
  if (onlyRecall) score -= 4;

  const cmdWords = ["explain", "describe", "compare"];
  const cmdFound = cmdWords.filter((cw) => textLower.includes(cw)).length;
  if (cmdFound < 2) score -= 2;

  return Math.max(0, Math.min(CATEGORY_WEIGHTS.examReadiness, score));
}

/**
 * STEP 8 — Clarity scoring (max 15)
 * Reward short paragraphs, simple language. Punish long blocks and vague phrases.
 */
function scoreClarity(lesson) {
  const blocks = getBlocks(lesson);
  const text = extractText(lesson);
  let score = CATEGORY_WEIGHTS.clarity;

  const contentBlocks = blocks.filter((b) => {
    const c = (b?.content || b?.prompt || "").toString().trim();
    return c.length > 0;
  });
  const blockTexts = contentBlocks.map((b) => (b?.content || b?.prompt || "").toString());
  const wordCounts = blockTexts.map((t) => (t.match(/\S+/g) || []).length);
  const longBlocks = blockTexts.filter((t) => {
    const sentences = (t.match(/[.!?]+/g) || []).length;
    const words = (t.match(/\S+/g) || []).length;
    return sentences > 3 || words > 80;
  });
  if (longBlocks.length >= 2) score -= 4;
  if (longBlocks.length >= 4) score -= 3;

  const vaguePhrases = [
    "helps the cell do its job",
    "important for the function",
    "used for many things",
  ];
  const vagueCount = vaguePhrases.filter((vp) => text.toLowerCase().includes(vp)).length;
  if (vagueCount >= 1) score -= 3;
  if (vagueCount >= 2) score -= 2;

  const avgWords = wordCounts.reduce((a, b) => a + b, 0) / Math.max(1, wordCounts.length);
  if (avgWords > 120) score -= 2;

  return Math.max(0, Math.min(CATEGORY_WEIGHTS.clarity, score));
}

/**
 * STEP 9 — Completeness scoring (max 20)
 * Curriculum issues cap completeness significantly.
 */
function scoreCompleteness(lesson, context) {
  const blocks = getBlocks(lesson);
  const curriculumIssues = context?.curriculumIssues ?? [];
  let score = CATEGORY_WEIGHTS.completeness;

  if (curriculumIssues.length > 0) {
    score -= Math.min(10, curriculumIssues.length * 3);
  }

  const diagramCount = blocks.filter((b) => safeStr(b?.type, "") === "diagram").length;
  if (diagramCount < 1) score -= 5;
  if (diagramCount < 2) score -= 3;

  const keyIdeaCount = blocks.filter((b) =>
    ["keyIdea", "keyIdeas"].includes(safeStr(b?.type, ""))
  ).length;
  if (keyIdeaCount < 2) score -= 4;
  if (keyIdeaCount < 4) score -= 2;

  if (!hasRole(blocks, "finalMemoryRule")) score -= 4;

  const checkpointCount = blocks.filter((b) => safeStr(b?.type, "") === "checkpoint").length;
  if (checkpointCount < 1) score -= 3;
  if (checkpointCount < 2) score -= 2;

  return Math.max(0, Math.min(CATEGORY_WEIGHTS.completeness, score));
}

/**
 * Build issues and suggestions from category scores and context.
 */
function buildIssuesAndSuggestions(categories, context) {
  const issues = [];
  const suggestions = [];
  const structureIssues = context?.structureIssues ?? [];
  const curriculumIssues = context?.curriculumIssues ?? [];

  structureIssues.forEach((s) => issues.push(s));
  curriculumIssues.forEach((c) => issues.push(c));

  if (categories.structure < CATEGORY_WEIGHTS.structure * 0.6) {
    suggestions.push("Add all required block roles and valid opening/closing sequences");
    suggestions.push("Include at least 2 diagrams, checkpoints, and What to Notice blocks");
  }
  if (categories.pedagogy < CATEGORY_WEIGHTS.pedagogy * 0.6) {
    suggestions.push("Add core rule, misconception correction, pattern recognition, and synthesis");
    suggestions.push("Use guided explanations (because, so that) — avoid note-dumping");
  }
  if (categories.examReadiness < CATEGORY_WEIGHTS.examReadiness * 0.6) {
    suggestions.push("Add worked example with model answer; use Explain, Describe, Compare in checkpoints");
    suggestions.push("Include at least 2 exam tip blocks and exam-style questions");
  }
  if (categories.clarity < CATEGORY_WEIGHTS.clarity * 0.6) {
    suggestions.push("Use short paragraphs (max 3 sentences); avoid vague phrases");
    suggestions.push("Replace phrases like 'helps the cell do its job' with specific functions");
  }
  if (categories.completeness < CATEGORY_WEIGHTS.completeness * 0.6) {
    suggestions.push("Add more diagrams, key idea blocks, and final memory rule");
    suggestions.push("Ensure major concepts are covered");
  }

  return { issues, suggestions };
}

/**
 * Score lesson quality (0-100) and return full result.
 * Total = sum of category scores (each 0 to its weight).
 */
function scoreLessonQuality(lesson, context = {}) {
  const structureIssues = context.structureIssues ?? validateLessonStructure(lesson);

  const categories = {
    structure: scoreStructure(lesson, { ...context, structureIssues }),
    pedagogy: scorePedagogy(lesson),
    examReadiness: scoreExamReadiness(lesson),
    clarity: scoreClarity(lesson),
    completeness: scoreCompleteness(lesson, context),
  };

  const score = Math.round(
    Object.values(categories).reduce((sum, v) => sum + v, 0)
  );
  const clampedScore = Math.max(0, Math.min(100, score));
  const band = getLessonQualityBand(clampedScore);
  const passed = band !== "poor" && band !== "weak";
  const { issues, suggestions } = buildIssuesAndSuggestions(categories, { ...context, structureIssues });

  return {
    score: clampedScore,
    band,
    passed,
    categories,
    issues,
    suggestions,
  };
}

module.exports = {
  scoreLessonQuality,
  getLessonQualityBand,
  CATEGORY_WEIGHTS,
  BAND_THRESHOLDS,
};
