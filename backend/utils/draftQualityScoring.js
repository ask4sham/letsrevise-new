/**
 * Lightweight heuristic quality scores (0–100) for AI/draft bank items.
 * Reuses reviewQualityFlags; no ML. Does not block saves.
 */
const { flashcardFlags, quizMcqFlags, examFlags } = require("./reviewQualityFlags");

const SCORE_VERSION = "1";

/** Penalties by flag id (start from 100, subtract, clamp). */
const FC_PEN = {
  answer_too_short: 22,
  answer_too_long: 12,
  vague_front: 28,
  likely_duplicate_concept: 32,
};
const QUIZ_PEN = {
  question_too_short_or_unclear: 24,
  explanation_too_short: 16,
  weak_distractors: 22,
  duplicate_concept: 28,
  all_or_none_options: 38,
};
const EXAM_PEN = {
  weak_mark_scheme: 22,
  marks_depth_mismatch: 20,
  missing_command_word_clarity: 14,
};

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function deriveQualityBand(score) {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

/** Detect weak MCQ patterns not in single-item quizMcqFlags. */
function extraQuizMcqFlags(it) {
  const flags = [];
  const blob = [it.questionText, ...((Array.isArray(it.choices) ? it.choices : []) || [])].join(" ");
  if (/\ball\s+of\s+the\s+above\b|\bnone\s+of\s+the\s+above\b/i.test(blob)) {
    flags.push("all_or_none_options");
  }
  return flags;
}

/**
 * @returns {{ qualityScore: number, qualityBand: string, qualityFlags: string[], approvalConfidence: number }}
 */
function scoreFlashcardDraft(input) {
  const flags = flashcardFlags(input);
  let s = 100;
  for (const f of flags) {
    s -= FC_PEN[f] ?? 15;
  }
  s = clampScore(s);
  return {
    qualityScore: s,
    qualityBand: deriveQualityBand(s),
    qualityFlags: flags,
    approvalConfidence: s / 100,
  };
}

function scoreQuizMcqDraft(input) {
  const base = quizMcqFlags(input);
  const extra = extraQuizMcqFlags(input);
  const flags = [...base, ...extra.filter((x) => !base.includes(x))];
  let s = 100;
  for (const f of flags) {
    s -= QUIZ_PEN[f] ?? 14;
  }
  s = clampScore(s);
  return {
    qualityScore: s,
    qualityBand: deriveQualityBand(s),
    qualityFlags: flags,
    approvalConfidence: s / 100,
  };
}

/**
 * @param {{ question?: string, marks?: number, markScheme?: string[], type?: string }} input
 */
function scoreExamDraft(input) {
  const flags = examFlags(input);
  let s = 100;
  for (const f of flags) {
    s -= EXAM_PEN[f] ?? 12;
  }
  const q = String(input.question || "");
  const ma = String(input.modelAnswer || input.correctAnswer || "").trim();
  if (q.length > 0 && ma.length > 0 && ma.length < 15) {
    flags.push("model_answer_too_short");
    s -= 10;
  }
  s = clampScore(s);
  return {
    qualityScore: s,
    qualityBand: deriveQualityBand(s),
    qualityFlags: flags,
    approvalConfidence: s / 100,
  };
}

/**
 * Merge scoring into metadata object for persistence.
 * @param {{ qualityScore: number, qualityBand: string, qualityFlags: string[], approvalConfidence: number }} r
 * @param {"heuristic" | "autopilot"} scoredBy
 */
function metadataQualityPatch(r, scoredBy) {
  return {
    qualityScore: r.qualityScore,
    qualityBand: r.qualityBand,
    qualityFlags: r.qualityFlags,
    approvalConfidence: r.approvalConfidence,
    qualityScoredAt: new Date().toISOString(),
    qualityScoredBy: scoredBy,
    scoreVersion: SCORE_VERSION,
  };
}

function isAiGeneratedBankDraft(doc) {
  const m = doc?.metadata || {};
  return m.source === "ai_lesson_assets" || m.aiGenerated === true || m.generatedBy === "autopilot";
}

/** Score-on-read for lean flashcard doc (does not persist). */
function ensureLeanFlashcardScored(doc) {
  if (!isAiGeneratedBankDraft(doc) || doc.metadata?.qualityScore != null) return doc;
  const r = scoreFlashcardDraft({
    front: doc.front,
    back: doc.back,
    pageId: doc.metadata?.pageId,
  });
  return {
    ...doc,
    metadata: { ...(doc.metadata || {}), ...metadataQualityPatch(r, "heuristic") },
  };
}

function ensureLeanQuizScored(doc) {
  if (!isAiGeneratedBankDraft(doc) || doc.metadata?.qualityScore != null) return doc;
  const r = scoreQuizMcqDraft({
    questionText: doc.questionText,
    choices: doc.choices,
    explanation: doc.explanation,
    correctIndex: doc.correctIndex,
  });
  return {
    ...doc,
    metadata: { ...(doc.metadata || {}), ...metadataQualityPatch(r, "heuristic") },
  };
}

function ensureLeanExamScored(doc) {
  if (!isAiGeneratedBankDraft(doc) || doc.metadata?.qualityScore != null) return doc;
  const r = scoreExamDraft({
    question: doc.question,
    marks: doc.marks,
    markScheme: doc.markScheme,
    type: doc.type,
    modelAnswer: doc.metadata?.modelAnswer,
    correctAnswer: doc.correctAnswer,
  });
  return {
    ...doc,
    metadata: { ...(doc.metadata || {}), ...metadataQualityPatch(r, "heuristic") },
  };
}

/**
 * In-memory score for approval queue items (lean doc + itemType).
 */
function scoreLeanDocForItemType(itemType, doc) {
  if (itemType === "flashcard") {
    return scoreFlashcardDraft({ front: doc.front, back: doc.back, pageId: doc.metadata?.pageId });
  }
  if (itemType === "quizQuestion") {
    return scoreQuizMcqDraft({
      questionText: doc.questionText,
      choices: doc.choices,
      explanation: doc.explanation,
      correctIndex: doc.correctIndex,
    });
  }
  if (itemType === "examQuestion") {
    return scoreExamDraft({
      question: doc.question,
      marks: doc.marks,
      markScheme: doc.markScheme,
      type: doc.type,
      modelAnswer: doc.metadata?.modelAnswer,
      correctAnswer: doc.correctAnswer,
    });
  }
  return { qualityScore: 0, qualityBand: "low", qualityFlags: [], approvalConfidence: 0 };
}

/** Major blocking flags for approval suggestion. */
function hasBlockingApprovalFlags(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return false;
  const block = new Set([
    "likely_duplicate_concept",
    "duplicate_concept",
    "all_or_none_options",
    "weak_mark_scheme",
    "marks_depth_mismatch",
  ]);
  return flags.some((f) => block.has(f));
}

function severeQualityFlag(f) {
  return [
    "vague_front",
    "question_too_short_or_unclear",
    "all_or_none_options",
    "likely_duplicate_concept",
    "duplicate_concept",
    "weak_mark_scheme",
    "answer_too_short",
  ].includes(f);
}

/**
 * Quality autopilot: rewrite only weaker drafts; high scores skipped.
 * @param {number} score
 * @param {string[]} flags
 */
function eligibleForQualityRewrite(score, flags) {
  if (score >= 80) return false;
  if (!flags || flags.length === 0) return false;
  if (score < 60) return true;
  if (flags.length >= 2) return true;
  return flags.some(severeQualityFlag);
}

module.exports = {
  SCORE_VERSION,
  deriveQualityBand,
  scoreFlashcardDraft,
  scoreQuizMcqDraft,
  scoreExamDraft,
  metadataQualityPatch,
  isAiGeneratedBankDraft,
  ensureLeanFlashcardScored,
  ensureLeanQuizScored,
  ensureLeanExamScored,
  scoreLeanDocForItemType,
  hasBlockingApprovalFlags,
  eligibleForQualityRewrite,
  severeQualityFlag,
};
