/**
 * PR-Q1: Normalization and dedupe for topic quiz questions.
 * PR-QUIZ-BANK-TYPES-1: short-answer fingerprint.
 */

function normalizeText(s) {
  if (s == null || typeof s !== "string") return "";
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Fingerprint MCQ: kind + questionText + choices (normalized, joined) + correctIndex
 * PR-A1: kind ensures quiz and assessment items do not collide.
 */
function fingerprint(questionText, choices, correctIndex, kind = "quiz") {
  const k = ["quiz", "assessment"].includes(String(kind || "").toLowerCase()) ? String(kind).toLowerCase() : "quiz";
  const nq = normalizeText(questionText);
  const normChoices = (Array.isArray(choices) ? choices : [])
    .map((c) => normalizeText(String(c)))
    .filter(Boolean);
  const idx = Number.isFinite(correctIndex) ? Math.max(0, Math.min(correctIndex, normChoices.length - 1)) : 0;
  return `${k}||${nq}||${normChoices.join("||")}||${idx}`;
}

/**
 * Fingerprint short-answer: kind + questionText + acceptableAnswers (normalized, joined) + matchMode
 */
function fingerprintShortAnswer(questionText, acceptableAnswers, matchMode, kind = "quiz") {
  const k = ["quiz", "assessment"].includes(String(kind || "").toLowerCase()) ? String(kind).toLowerCase() : "quiz";
  const nq = normalizeText(questionText);
  const norm = (Array.isArray(acceptableAnswers) ? acceptableAnswers : [])
    .map((a) => normalizeText(String(a)))
    .filter(Boolean);
  const mode = (matchMode === "exact" || matchMode === "contains") ? matchMode : "contains";
  return `${k}||short||${nq}||${norm.join("||")}||${mode}`;
}

/**
 * Build fingerprint for an item (mcq or short-answer).
 */
function fingerprintItem(item, defaultKind = "quiz") {
  const kind = ["quiz", "assessment"].includes(String(item.kind || "").toLowerCase()) ? String(item.kind).toLowerCase() : defaultKind;
  const type = (item.type === "short-answer") ? "short-answer" : "mcq";
  if (type === "short-answer") {
    const answers = Array.isArray(item.acceptableAnswers) ? item.acceptableAnswers : [];
    const mode = (item.matchMode === "exact" || item.matchMode === "contains") ? item.matchMode : "contains";
    return fingerprintShortAnswer(item.questionText || "", answers, mode, kind);
  }
  const choices = Array.isArray(item.choices) ? item.choices : [];
  const ci = Number.isFinite(item.correctIndex) ? Math.max(0, Math.min(item.correctIndex, choices.length - 1)) : 0;
  return fingerprint(item.questionText || "", choices, ci, kind);
}

/**
 * @param {Array<{ type?: string; questionText: string; choices?: string[]; correctIndex?: number; acceptableAnswers?: string[]; matchMode?: string; kind?: string }>} items
 * @param {string} [defaultKind] - default "quiz"
 */
function dedupeIncoming(items, defaultKind = "quiz") {
  const seen = new Set();
  const uniqueItems = [];
  const duplicatesInPayload = [];
  const k = ["quiz", "assessment"].includes(String(defaultKind || "").toLowerCase()) ? String(defaultKind).toLowerCase() : "quiz";

  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    const q = (c.questionText || "").trim();
    const itemKind = ["quiz", "assessment"].includes(String(c.kind || "").toLowerCase()) ? String(c.kind).toLowerCase() : k;
    const type = (c.type === "short-answer") ? "short-answer" : "mcq";

    let fp;
    if (type === "short-answer") {
      const answers = Array.isArray(c.acceptableAnswers) ? c.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean) : [];
      const mode = (c.matchMode === "exact" || c.matchMode === "contains") ? c.matchMode : "contains";
      fp = fingerprintShortAnswer(q, answers, mode, itemKind);
    } else {
      const choices = Array.isArray(c.choices) ? c.choices.map((x) => String(x).trim()).filter(Boolean) : [];
      const ci = Math.min(Math.max(0, Number(c.correctIndex)), Math.max(0, choices.length - 1));
      fp = fingerprint(q, choices, ci, itemKind);
    }

    if (seen.has(fp)) {
      duplicatesInPayload.push({ index: i, questionText: q, choices: c.choices, type });
    } else {
      seen.add(fp);
      const entry = { ...c, questionText: q, kind: itemKind, type, fingerprint: fp };
      if (type === "mcq") {
        const choices = Array.isArray(c.choices) ? c.choices.map((x) => String(x).trim()).filter(Boolean) : [];
        entry.choices = choices;
        entry.correctIndex = Math.min(Math.max(0, Number(c.correctIndex)), Math.max(0, choices.length - 1));
      } else {
        entry.acceptableAnswers = Array.isArray(c.acceptableAnswers) ? c.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean) : [];
        entry.matchMode = (c.matchMode === "exact" || c.matchMode === "contains") ? c.matchMode : "contains";
      }
      uniqueItems.push(entry);
    }
  }
  return { uniqueItems, duplicatesInPayload };
}

module.exports = {
  normalizeText,
  fingerprint,
  fingerprintShortAnswer,
  fingerprintItem,
  dedupeIncoming,
};
