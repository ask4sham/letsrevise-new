/**
 * Heuristic review flags for AI/draft topic-bank items (no ML — cheap string checks).
 * Used on list read; optional duplicate-in-batch signals from sibling items in the same response.
 */

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function wordCount(s) {
  const t = String(s || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** @param {{ front?: string; back?: string }} it */
function flashcardFlags(it) {
  const flags = [];
  const front = String(it.front || "");
  const back = String(it.back || "");
  if (back.length > 0 && back.length < 40) flags.push("answer_too_short");
  if (back.length > 900) flags.push("answer_too_long");
  if (wordCount(front) < 4 && front.length < 35) flags.push("vague_front");
  const vagueOnly = /^(what|why|how|define|name|state|describe|explain)\s*(\?)?$/i.test(front.trim());
  if (vagueOnly && back.length < 60) flags.push("vague_front");
  return flags;
}

/**
 * @param {Array<{ front?: string; back?: string; _id?: string }>} items
 */
function enrichFlashcardItems(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const frontKeyCounts = new Map();
  for (const it of items) {
    const k = norm(it.front).slice(0, 80);
    if (!k) continue;
    frontKeyCounts.set(k, (frontKeyCounts.get(k) || 0) + 1);
  }
  return items.map((it) => {
    const flags = flashcardFlags(it);
    const k = norm(it.front).slice(0, 80);
    if (k && (frontKeyCounts.get(k) || 0) > 1) flags.push("likely_duplicate_concept");
    return { ...it, reviewFlags: flags };
  });
}

/** @param {{ questionText?: string; choices?: string[]; explanation?: string }} it */
function quizMcqFlags(it) {
  const flags = [];
  const q = String(it.questionText || "");
  const expl = String(it.explanation || "");
  const choices = Array.isArray(it.choices) ? it.choices.map((c) => String(c || "").trim()).filter(Boolean) : [];
  if (q.length > 0 && q.length < 28) flags.push("question_too_short_or_unclear");
  if (expl.length > 0 && expl.length < 35) flags.push("explanation_too_short");
  const nonEmpty = choices.filter((c) => c.length >= 2);
  if (nonEmpty.length >= 2) {
    const lens = nonEmpty.map((c) => c.length);
    const minL = Math.min(...lens);
    const maxL = Math.max(...lens);
    if (maxL < 6 && minL < 6) flags.push("weak_distractors");
    const uniqLens = new Set(lens);
    if (uniqLens.size === 1 && lens[0] < 8) flags.push("weak_distractors");
  } else {
    flags.push("weak_distractors");
  }
  return flags;
}

/**
 * @param {Array<{ questionText?: string; choices?: string[]; explanation?: string }>} items
 */
function enrichQuizMcqItems(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const qKeyCounts = new Map();
  for (const it of items) {
    const k = norm(it.questionText).slice(0, 100);
    if (!k) continue;
    qKeyCounts.set(k, (qKeyCounts.get(k) || 0) + 1);
  }
  return items.map((it) => {
    const flags = quizMcqFlags(it);
    const k = norm(it.questionText).slice(0, 100);
    if (k && (qKeyCounts.get(k) || 0) > 1) flags.push("duplicate_concept");
    return { ...it, reviewFlags: flags };
  });
}

/** @param {{ question?: string; markScheme?: string[]; marks?: number; type?: string }} it */
function examFlags(it) {
  const flags = [];
  const q = String(it.question || "");
  const marks = Number(it.marks);
  const ms = Array.isArray(it.markScheme) ? it.markScheme : [];
  const msText = ms.map((l) => String(l || "").trim()).join("\n");
  const totalMs = msText.length;
  if (ms.length > 0 && totalMs < 15 * Math.max(1, Number.isFinite(marks) ? marks : 1)) {
    flags.push("weak_mark_scheme");
  }
  if (Number.isFinite(marks) && marks >= 4 && q.length > 0 && q.length < 45) {
    flags.push("marks_depth_mismatch");
  }
  const cmd = /\b(explain|describe|outline|calculate|suggest|compare|evaluate|analyse|analyze|justify)\b/i;
  if (q.length > 20 && !cmd.test(q) && marks >= 3) {
    flags.push("missing_command_word_clarity");
  }
  return flags;
}

/**
 * @param {Array<{ question?: string; markScheme?: string[]; marks?: number; type?: string }>} items
 */
function enrichExamItems(items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  return items.map((it) => ({ ...it, reviewFlags: examFlags(it) }));
}

module.exports = {
  flashcardFlags,
  quizMcqFlags,
  examFlags,
  enrichFlashcardItems,
  enrichQuizMcqItems,
  enrichExamItems,
};
