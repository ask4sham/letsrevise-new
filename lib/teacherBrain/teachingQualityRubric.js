/**
 * Phase 3H.1.7 — Teaching Quality Rubric Engine.
 *
 * Scores lessons 0–40 (eight dimensions × 0–5). Diagnostics and prompt guidance only —
 * does not mutate, rewrite, or auto-repair saved lessons.
 *
 * Flag: TEACHER_BRAIN_TEACHING_QUALITY=1
 */

const {
  blockFlowText,
  blockMentionsComparison,
  examTipLooksSpecific,
  finalMemoryRuleLooksSpecific,
  keyIdeaLooksSpecific,
  soundsTeacherLike,
} = require("../../backend/services/lessonDraftValidation");
const { flattenPagesToBlocks, blockHaystack, normalizeText } = require("../lessonBlockAnalysis");
const { resolveTeacherFirstKnowledgeProfile } = require("./teacherFirstKnowledgeProfiles");

const RUBRIC_MARKER = "TEACHING QUALITY REQUIREMENTS";
const MAX_DIMENSION_SCORE = 5;
const DIMENSION_COUNT = 8;
const MAX_TOTAL_SCORE = MAX_DIMENSION_SCORE * DIMENSION_COUNT;

/** @typedef {keyof typeof TEACHING_QUALITY_DIMENSIONS} TeachingQualityDimensionId */

const TEACHING_QUALITY_DIMENSIONS = {
  coreConceptClarity: {
    id: "coreConceptClarity",
    label: "Core Concept Clarity",
    shortLabel: "core concept clarity",
    missingLabel: "core concept clarity",
  },
  misconceptionHandling: {
    id: "misconceptionHandling",
    label: "Misconception Handling",
    shortLabel: "misconception",
    missingLabel: "misconception",
  },
  examinerGuidance: {
    id: "examinerGuidance",
    label: "Examiner Guidance",
    shortLabel: "examiner tip",
    missingLabel: "examiner tip",
  },
  workedReasoning: {
    id: "workedReasoning",
    label: "Worked Reasoning",
    shortLabel: "worked reasoning",
    missingLabel: "worked reasoning",
  },
  retrievalPractice: {
    id: "retrievalPractice",
    label: "Retrieval Practice",
    shortLabel: "retrieval",
    missingLabel: "retrieval",
  },
  compareContrast: {
    id: "compareContrast",
    label: "Compare & Contrast",
    shortLabel: "compare/contrast",
    missingLabel: "compare/contrast",
  },
  grade79Extension: {
    id: "grade79Extension",
    label: "Grade 7–9 Extension",
    shortLabel: "Grade 7–9 extension",
    missingLabel: "Grade 7–9 extension",
  },
  memoryRule: {
    id: "memoryRule",
    label: "Memory Rule",
    shortLabel: "memory rule",
    missingLabel: "memory rule",
  },
};

function isTeachingQualityEnabled() {
  return String(process.env.TEACHER_BRAIN_TEACHING_QUALITY || "0").trim() === "1";
}

function normalizeLessonBlocks(lesson) {
  if (Array.isArray(lesson?.blocks)) return lesson.blocks;
  return flattenPagesToBlocks(lesson?.pages || []);
}

function stripHtml(text = "") {
  return String(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function topicTokens(lesson) {
  const topic = String(lesson?.topic || lesson?.subTopic || "").trim();
  if (!topic) return [];
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3);
}

function textMentionsTopic(text = "", lesson = {}) {
  const hay = String(text).toLowerCase();
  const tokens = topicTokens(lesson);
  if (!tokens.length) return hay.length > 40;
  return tokens.some((t) => hay.includes(t));
}

function findCoreTeachingBlock(blocks) {
  const byTitle = blocks.findIndex(
    (b) => /core teaching/i.test(String(b?.title || "")) && String(b?.type || "") === "text"
  );
  if (byTitle >= 0) return { block: blocks[byTitle], index: byTitle };

  const byRole = blocks.findIndex(
    (b) =>
      String(b?.role || "").trim() === "concept" &&
      /teach|core/i.test(String(b?.title || ""))
  );
  if (byRole >= 0) return { block: blocks[byRole], index: byRole };

  return { block: null, index: -1 };
}

function hasMisconceptionFormat(text = "") {
  const t = String(text);
  return /wrong\s*:/i.test(t) && /correct\s*:/i.test(t) && /exam link\s*:/i.test(t);
}

function hasReasoningChain(text = "") {
  const t = String(text);
  const causal = (t.match(/\bbecause\b|\btherefore\b|\bso that\b|\bthis means\b/gi) || []).length;
  const hasSteps =
    /<ol[\s>]/i.test(t) ||
    /^\s*\d+[.)]\s/m.test(t) ||
    causal >= 2;
  const hasMarks = /\(\s*\d+\s*marks?\s*\)/i.test(t) || /\b\d[\s-]?mark/i.test(t);
  return hasSteps && (hasMarks || /question\s*:/i.test(t) || causal >= 2);
}

function hasGrade79Signals(text = "") {
  const t = String(text);
  if (!/grade\s*[789]|top[\s-]?band|higher tier|full[\s-]?mark|stretch/i.test(t)) {
    return false;
  }
  const causal =
    (t.match(/\bbecause\b|\btherefore\b|\bso that\b|\ballows\b|\benables\b/gi) || []).length >= 1;
  return stripHtml(t).length >= 60 && causal;
}

function countCheckpoints(blocks) {
  return blocks.filter((b) => String(b?.type || "") === "checkpoint");
}

function scoreCoreConceptClarity(blocks, lesson, coreTeaching) {
  let score = 0;
  const signals = [];

  const definitionBlock = blocks.find(
    (b) =>
      /definition/i.test(String(b?.title || "")) ||
      String(b?.role || "") === "definition"
  );
  const coreRule = blocks.find((b) => String(b?.role || "") === "coreRule");
  const coreHtml = blockFlowText(coreTeaching.block);

  if (definitionBlock || /definition|is the regulation|is a/i.test(coreHtml)) {
    score += 1;
    signals.push("definition");
  }

  if (coreRule || /core model|core rule/i.test(blocks.map((b) => b?.title).join(" "))) {
    score += 1;
    signals.push("coreModel");
  }

  const teachable = [coreHtml, ...blocks.slice(0, 8).map((b) => blockFlowText(b))].join(" ");
  if (/\bstructure\b.*\bfunction\b|\bfunction\b.*\bstructure\b|\bcause\b.*\beffect\b/i.test(teachable)) {
    score += 1;
    signals.push("structureFunction");
  }

  if (soundsTeacherLike(teachable)) {
    score += 1;
    signals.push("teacherVoice");
  }

  if (textMentionsTopic(teachable, lesson)) {
    score += 1;
    signals.push("topicSpecific");
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

function scoreMisconceptionHandling(blocks, lesson, coreTeaching) {
  let score = 0;
  const signals = [];
  const coreHtml = blockFlowText(coreTeaching.block);

  if (/misconception|students often|common mistake|what students often get wrong/i.test(coreHtml)) {
    score += 1;
    signals.push("misconceptionMentioned");
  }

  const cmBlocks = blocks.filter(
    (b) =>
      String(b?.type || "") === "commonMistake" || String(b?.role || "") === "commonMistake"
  );

  const formatted =
    (hasMisconceptionFormat(coreHtml) ? 1 : 0) +
    cmBlocks.filter((b) => hasMisconceptionFormat(blockFlowText(b))).length;

  if (formatted >= 1) {
    score += 2;
    signals.push("wrongCorrectFormat");
  } else if (/wrong|incorrect|mistake/i.test(coreHtml)) {
    score += 1;
    signals.push("partialFormat");
  }

  const best = [coreHtml, ...cmBlocks.map((b) => blockFlowText(b))].join(" ");
  if (textMentionsTopic(best, lesson)) {
    score += 1;
    signals.push("topicSpecific");
  }

  if (cmBlocks.length > 0 || /exam link/i.test(best)) {
    score += 1;
    signals.push("examConsequence");
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

function scoreExaminerGuidance(blocks, lesson) {
  let score = 0;
  const signals = [];
  const examTips = blocks.filter((b) => ["examTip", "examTips"].includes(String(b?.type || "")));

  if (examTips.length >= 1) {
    score += 1;
    signals.push("examTipBlock");
  }
  if (examTips.length >= 2) {
    score += 1;
    signals.push("multipleExamTips");
  }

  const tipText = examTips.map((b) => blockFlowText(b)).join(" ");
  if (/premium exam tip|think like an examiner|examiner/i.test(tipText)) {
    score += 1;
    signals.push("examinerVoice");
  }
  if (/weak answer|better answer|full-mark answer/i.test(tipText)) {
    score += 1;
    signals.push("answerModelling");
  }
  if (examTips.some((b) => examTipLooksSpecific(b, lesson))) {
    score += 1;
    signals.push("specificTip");
  } else if (/marks?|credit|command word|wording/i.test(tipText)) {
    score += 1;
    signals.push("markGuidance");
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

function scoreWorkedReasoning(blocks) {
  let score = 0;
  const signals = [];
  const coreTeaching = findCoreTeachingBlock(blocks);
  const coreHtml = blockFlowText(coreTeaching.block);

  const worked = blocks.find((b) => String(b?.role || "") === "workedExample");
  if (worked) {
    score += 1;
    signals.push("workedExampleRole");
  }

  const workedText = worked ? blockFlowText(worked) : "";
  const answerText = String(worked?.answer || worked?.explanation || "");
  if (answerText.length > 40) {
    score += 1;
    signals.push("modelAnswer");
  }
  if (/\(\s*\d+\s*marks?\s*\)/i.test(workedText) || /\b\d[\s-]?mark/i.test(workedText)) {
    score += 1;
    signals.push("markCount");
  }
  if (hasReasoningChain(workedText) || hasReasoningChain(answerText)) {
    score += 1;
    signals.push("reasoningChain");
  }
  if (/worked reasoning|worked example|🧠/i.test(coreHtml) && hasReasoningChain(coreHtml)) {
    score += 1;
    signals.push("coreTeachingWorked");
  }

  const bullets = answerText.split("\n").filter((l) => /^\s*[-•]\s?/.test(l.trimStart())).length;
  if (bullets >= 3) {
    score += 1;
    signals.push("markingPoints");
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

function scoreRetrievalPractice(blocks, coreTeaching) {
  let score = 0;
  const signals = [];
  const checkpoints = countCheckpoints(blocks);
  const coreHtml = blockFlowText(coreTeaching.block);
  const coreIdx = coreTeaching.index;

  if (checkpoints.length >= 1) {
    score += 1;
    signals.push("checkpoint");
  }
  if (checkpoints.length >= 2) {
    score += 1;
    signals.push("multipleCheckpoints");
  }

  if (/retrieval|before we go further|quick check|recall/i.test(coreHtml)) {
    score += 1;
    signals.push("retrievalInCoreTeaching");
  }

  if (coreIdx > 0) {
    const before = blocks.slice(0, coreIdx);
    const earlyCp = before.find((b) => String(b?.type || "") === "checkpoint");
    if (earlyCp) {
      score += 1;
      signals.push("checkpointBeforeCoreTeaching");
    }
  }

  const recallStems = checkpoints.filter((b) => {
    const stem = `${b?.prompt || ""} ${b?.question || ""}`.trim();
    return /^(state|name|what|which|identify|before)/i.test(stem);
  });
  if (recallStems.length >= 1) {
    score += 1;
    signals.push("recallStem");
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

function scoreCompareContrast(blocks, coreTeaching) {
  let score = 0;
  const signals = [];
  const coreHtml = blockFlowText(coreTeaching.block);
  const fullText = blocks.map((b) => blockFlowText(b)).join(" ");

  if (/compare|contrast|difference between|whereas|unlike|vs\.?/i.test(coreHtml)) {
    score += 1;
    signals.push("compareLanguage");
  }
  if (blockMentionsComparison(coreHtml)) {
    score += 1;
    signals.push("comparisonDetected");
  }

  const pattern = blocks.find((b) => String(b?.role || "") === "patternRecognition");
  if (pattern && blockMentionsComparison(blockFlowText(pattern))) {
    score += 2;
    signals.push("patternRecognition");
  }

  if (/compare and contrast|⚖️/i.test(coreHtml)) {
    score += 1;
    signals.push("dedicatedSection");
  }

  const namedPair = /(\w+\s+\w+)\s+(whereas|unlike|vs\.?|compared to)\s+(\w+)/i.test(fullText);
  if (namedPair) {
    score += 1;
    signals.push("namedPair");
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

function scoreGrade79Extension(blocks) {
  let score = 0;
  const signals = [];
  const stretch = blocks.find((b) => String(b?.type || "") === "stretch");
  const examTips = blocks.filter((b) => ["examTip", "examTips"].includes(String(b?.type || "")));
  const coreHtml = blockFlowText(findCoreTeachingBlock(blocks).block);

  if (stretch) {
    score += 1;
    signals.push("stretchBlock");
  }
  if (stretch && hasGrade79Signals(blockFlowText(stretch))) {
    score += 2;
    signals.push("stretchGrade79");
  }
  if (hasGrade79Signals(coreHtml)) {
    score += 2;
    signals.push("coreTeachingGrade79");
  }

  for (const tip of examTips) {
    const t = blockFlowText(tip);
    if (/full-mark answer/i.test(t)) {
      score += 1;
      signals.push("fullMarkModelling");
      break;
    }
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

function scoreMemoryRule(blocks, lesson) {
  let score = 0;
  const signals = [];
  const final = blocks.find((b) => String(b?.role || "") === "finalMemoryRule");
  const keyIdeas = blocks.filter((b) => String(b?.type || "") === "keyIdea");

  if (final) {
    score += 2;
    signals.push("finalMemoryRuleRole");
  } else if (keyIdeas.length > 0) {
    score += 1;
    signals.push("keyIdeaPresent");
  }

  if (final) {
    const text = blockFlowText(final);
    if (/💡|key insight/i.test(text)) {
      score += 1;
      signals.push("keyInsightHeading");
    }
    if (text.trim().length >= 30) {
      score += 1;
      signals.push("substantialRule");
    }
    if (finalMemoryRuleLooksSpecific(final, lesson)) {
      score += 1;
      signals.push("topicSpecific");
    } else if (keyIdeaLooksSpecific(final, lesson)) {
      score += 1;
      signals.push("specificKeyIdea");
    }
  }

  return { score: Math.min(MAX_DIMENSION_SCORE, score), signals };
}

const DIMENSION_SCORERS = {
  coreConceptClarity: (blocks, lesson, coreTeaching) =>
    scoreCoreConceptClarity(blocks, lesson, coreTeaching),
  misconceptionHandling: (blocks, lesson, coreTeaching) =>
    scoreMisconceptionHandling(blocks, lesson, coreTeaching),
  examinerGuidance: (blocks, lesson) => scoreExaminerGuidance(blocks, lesson),
  workedReasoning: (blocks) => scoreWorkedReasoning(blocks),
  retrievalPractice: (blocks, _lesson, coreTeaching) =>
    scoreRetrievalPractice(blocks, coreTeaching),
  compareContrast: (blocks, _lesson, coreTeaching) =>
    scoreCompareContrast(blocks, coreTeaching),
  grade79Extension: (blocks) => scoreGrade79Extension(blocks),
  memoryRule: (blocks, lesson) => scoreMemoryRule(blocks, lesson),
};

/**
 * @param {object} lesson
 * @param {object} [options]
 */
function scoreTeachingQuality(lesson, options = {}) {
  const enabled = options.forceEnabled === true || isTeachingQualityEnabled();
  const blocks = normalizeLessonBlocks(lesson);
  const coreTeaching = findCoreTeachingBlock(blocks);

  /** @type {Record<string, { id: string, label: string, score: number, maxScore: number, signals: string[] }>} */
  const dimensions = {};
  let totalScore = 0;

  for (const dim of Object.values(TEACHING_QUALITY_DIMENSIONS)) {
    const scorer = DIMENSION_SCORERS[dim.id];
    const result = scorer(blocks, lesson, coreTeaching);
    dimensions[dim.id] = {
      id: dim.id,
      label: dim.label,
      score: result.score,
      maxScore: MAX_DIMENSION_SCORE,
      signals: result.signals,
    };
    totalScore += result.score;
  }

  return {
    enabled,
    totalScore,
    maxTotalScore: MAX_TOTAL_SCORE,
    scoreLabel: `${totalScore}/${MAX_TOTAL_SCORE}`,
    scorePct: Math.round((totalScore / MAX_TOTAL_SCORE) * 100),
    dimensions,
    coreTeachingIndex: coreTeaching.index,
  };
}

/**
 * Build human-readable review for Coverage Review panel.
 * @param {object} lesson
 * @param {object} [options]
 */
function buildTeachingQualityReview(lesson, options = {}) {
  const scoring = scoreTeachingQuality(lesson, options);
  const enabled = scoring.enabled;

  if (!enabled) {
    return {
      enabled: false,
      totalScore: 0,
      maxTotalScore: MAX_TOTAL_SCORE,
      scoreLabel: `0/${MAX_TOTAL_SCORE}`,
      scorePct: 0,
      strengths: [],
      weaknesses: [],
      missing: [],
      present: [],
      dimensions: {},
    };
  }

  const strengths = [];
  const weaknesses = [];
  const missing = [];
  const present = [];

  for (const dim of Object.values(TEACHING_QUALITY_DIMENSIONS)) {
    const row = scoring.dimensions[dim.id];
    if (!row) continue;

    if (row.score === 0) {
      missing.push(dim.missingLabel);
    } else if (row.score >= 4) {
      strengths.push(dim.shortLabel);
      present.push(dim.shortLabel);
    } else if (row.score >= 3) {
      present.push(dim.shortLabel);
    } else if (row.score <= 2) {
      weaknesses.push(dim.shortLabel);
    }
  }

  return {
    enabled: true,
    totalScore: scoring.totalScore,
    maxTotalScore: scoring.maxTotalScore,
    scoreLabel: scoring.scoreLabel,
    scorePct: scoring.scorePct,
    strengths,
    weaknesses,
    missing,
    present,
    dimensions: scoring.dimensions,
    coreTeachingIndex: scoring.coreTeachingIndex,
  };
}

/**
 * Format review as plain-text lines (acceptance scripts, logs).
 */
function formatTeachingQualityReviewLines(review) {
  if (!review?.enabled) return "";
  const lines = [
    `Teaching Quality Score: ${review.scoreLabel}`,
    "",
    review.strengths?.length ? `Strengths: ${review.strengths.join(", ")}` : "Strengths: (none yet)",
    review.weaknesses?.length ? `Weaknesses: ${review.weaknesses.join(", ")}` : "",
    review.missing?.length ? `Missing: ${review.missing.join(", ")}` : "",
    review.present?.length ? `Present: ${review.present.join(", ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function isSupportedBiologyProfile(input = {}) {
  const profile = resolveTeacherFirstKnowledgeProfile({
    topicKey: input.topicKey,
    subTopic: input.subTopic || input.topic,
    subject: input.subject || "Biology",
    taxonomyKey: input.taxonomyKey,
  });
  return Boolean(profile?.taxonomyKey);
}

/**
 * Prompt appendix for supported Biology profiles when flag on.
 * @param {object} [input]
 */
function formatTeachingQualityAppendix(input = {}) {
  if (!isTeachingQualityEnabled()) return "";

  const profile = resolveTeacherFirstKnowledgeProfile({
    topicKey: input.topicKey,
    subTopic: input.subTopic || input.topic,
    subject: input.subject || "Biology",
    taxonomyKey: input.taxonomyKey,
  });

  if (!profile?.taxonomyKey) return "";

  const lines = [
    RUBRIC_MARKER,
    "",
    "Every generated lesson for this Biology sub-topic MUST include ALL of the following teaching elements.",
    "Write like a strong GCSE teacher — not an AI summary.",
    "",
    "REQUIRED (one each, topic-specific):",
    "1. Misconception block (commonMistake type OR section in Core Teaching)",
    "   Format: Wrong: … / Correct: … / Exam link: …",
    "2. Examiner tip (examTip block with mark-earning guidance for THIS sub-topic)",
    "3. Compare/contrast explanation (two confusable ideas — use whereas/unlike/difference between)",
    "4. Worked reasoning example (checkpoint role workedExample OR Core Teaching section)",
    "   Include mark count and reasoning steps (because/therefore/so that)",
    "5. Retrieval question BEFORE or at the start of Core Teaching (recall, not worked example)",
    "6. Memory rule (keyIdea role finalMemoryRule with 💡 Key Insight — 1–3 memorable lines)",
    "",
    "ALSO REQUIRED for Grade 7–9 depth:",
    "- Stretch block OR Grade 7–9 / top-band explanation with structure→function→exam chain",
    "",
    `Topic profile: ${profile.taxonomyKey}`,
  ];

  if (profile.definition) {
    lines.push("", "Anchor definition (do not replace with scenario):", profile.definition.slice(0, 200));
  }
  if (Array.isArray(profile.keyExamples) && profile.keyExamples.length) {
    lines.push("", "Use these examples where relevant:", profile.keyExamples.slice(0, 3).join("; "));
  }

  return lines.join("\n");
}

/** @deprecated use formatTeachingQualityAppendix */
function buildTeachingQualityRubricPromptSection(input = {}) {
  return formatTeachingQualityAppendix(input);
}

/** @deprecated use isTeachingQualityEnabled */
function isTeachingQualityRubricEnabled() {
  return isTeachingQualityEnabled();
}

/** @deprecated use scoreTeachingQuality */
function evaluateTeachingQualityRubric(lesson, options = {}) {
  const scoring = scoreTeachingQuality(lesson, options);
  const review = buildTeachingQualityReview(lesson, options);
  return {
    enabled: scoring.enabled,
    passed: review.missing.length === 0,
    teachingQualityScorePct: scoring.scorePct,
    totalScore: scoring.totalScore,
    maxTotalScore: scoring.maxTotalScore,
    scoreLabel: scoring.scoreLabel,
    ...review,
  };
}

module.exports = {
  RUBRIC_MARKER,
  TEACHING_QUALITY_DIMENSIONS,
  MAX_DIMENSION_SCORE,
  MAX_TOTAL_SCORE,
  isTeachingQualityEnabled,
  isTeachingQualityRubricEnabled,
  scoreTeachingQuality,
  buildTeachingQualityReview,
  formatTeachingQualityReviewLines,
  formatTeachingQualityAppendix,
  buildTeachingQualityRubricPromptSection,
  evaluateTeachingQualityRubric,
  isSupportedBiologyProfile,
  // test helpers
  hasMisconceptionFormat,
  hasReasoningChain,
  hasGrade79Signals,
};
