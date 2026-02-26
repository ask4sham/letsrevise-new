/**
 * PR-QUIZ-TYPES-1: Canonical quiz import format helpers.
 * Used by POST /api/topic-quiz-questions/bulk/preview (format=csv) via parseBulkQuizQuestions.
 * normalizeQuizType, parseCsvToQuizItems, validateQuizItem.
 */
const { validateMcq, validateShortAnswer } = require("./quizQuestionValidation");

/**
 * Normalize type string to "mcq" or "short-answer".
 * Accepts: "mcq", "MCQ", "short", "short-answer", "short_answer", "Short Answer", etc.
 */
function normalizeQuizType(v) {
  if (v == null || typeof v !== "string") return "mcq";
  const t = String(v).trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  if (t === "mcq") return "mcq";
  if (t === "short" || t === "short-answer" || t === "shortanswer") return "short-answer";
  return "mcq";
}

/**
 * Parse a single CSV row (array of cells) with given header indices and type.
 * Returns one normalized item or null; errors go into errors array.
 * @param {string} [rawLine] - optional raw line for error reporting (row index, reason, raw).
 */
function parseCsvRowToItem(cells, headerLower, type, rowIndex, errors, rawLine = "") {
  const topicKeyIdx = headerLower.findIndex((h) => h === "topickey" || h === "topic_key");
  const questionIdx = headerLower.findIndex((h) => h === "question");
  const choiceCols = ["choicea", "choiceb", "choicec", "choiced", "choicee", "choicef"];
  const choiceIdxs = choiceCols.map((c) => headerLower.findIndex((h) => h === c || h.replace(/\s/g, "") === c));
  const correctIdx = headerLower.findIndex((h) => /correct/i.test(h));
  const acceptableIdx = headerLower.findIndex((h) => /acceptable/i.test(h));
  const explIdx = headerLower.findIndex((h) => /explanation/i.test(h));

  const topicKey = (topicKeyIdx >= 0 ? (cells[topicKeyIdx] || "").trim() : "").trim() || null;
  const questionText = (questionIdx >= 0 ? (cells[questionIdx] || "").trim() : (cells[0] || "").trim()).trim();
  const explanation = (explIdx >= 0 ? (cells[explIdx] || "").trim() : "").trim();

  if (!questionText) {
    errors.push({ row: rowIndex + 1, message: "Missing question", code: "MISSING_QUESTION", raw: rawLine });
    return null;
  }

  const resolvedType = type === "short-answer" ? "short-answer" : "mcq";

  if (resolvedType === "short-answer") {
    const acceptableRaw = acceptableIdx >= 0 ? String(cells[acceptableIdx] || "").trim() : "";
    const acceptableAnswers = acceptableRaw ? acceptableRaw.split("|").map((a) => a.trim()).filter(Boolean) : [];
    const item = {
      type: "short-answer",
      topicKey,
      questionText,
      acceptableAnswers,
      explanation: explanation || undefined,
      matchMode: "contains",
    };
    const err = validateQuizItem(item);
    if (err) {
      errors.push({ row: rowIndex + 1, message: err.message, code: err.code || "INVALID_ROW", raw: rawLine });
      return null;
    }
    item._raw = rawLine;
    item._index = rowIndex + 1;
    return item;
  }

  let choices = [];
  for (const idx of choiceIdxs) {
    if (idx >= 0 && cells[idx]) choices.push(String(cells[idx]).trim());
  }
  choices = choices.filter(Boolean);
  let correctIndex = 0;
  if (correctIdx >= 0 && cells[correctIdx]) {
    const v = String(cells[correctIdx]).trim().toUpperCase();
    if (/^[A-F]$/.test(v)) correctIndex = v.charCodeAt(0) - 65;
    else if (/^\d+$/.test(v)) correctIndex = Math.max(0, Math.min(parseInt(v, 10), choices.length - 1));
  }
  const item = {
    type: "mcq",
    topicKey,
    questionText,
    choices,
    correctIndex,
    explanation: explanation || undefined,
  };
  const err = validateQuizItem(item);
  if (err) {
    errors.push({ row: rowIndex + 1, message: err.message, code: err.code || "INVALID_ROW", raw: rawLine });
    return null;
  }
  item._raw = rawLine;
  item._index = rowIndex + 1;
  return item;
}

/**
 * Parse CSV text into quiz items (canonical MCQ or Short Answer format).
 * @param {Object} opts - { csvText: string, type: "mcq" | "short-answer" }
 * @returns {{ items: Array, errors: Array<{ row, message, code }> }}
 */
function parseCsvToQuizItems({ csvText, type }) {
  const items = [];
  const errors = [];
  const resolvedType = normalizeQuizType(type);
  const text = (csvText && String(csvText).trim()) || "";
  if (!text) return { items, errors };

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { items, errors };

  const delim = text.indexOf("\t") >= 0 ? "\t" : ",";
  const headerRow = lines[0];
  const headerCells = headerRow.split(delim).map((c) => (c || "").trim());
  const headerLower = headerCells.map((h) => (h || "").toLowerCase().replace(/\s/g, ""));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (ch === delim || ch === "\t")) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    const item = parseCsvRowToItem(cells, headerLower, resolvedType, i, errors, line);
    if (item) items.push(item);
  }
  return { items, errors };
}

/**
 * Validate a single quiz item (MCQ or short-answer).
 * @returns {null} if valid, or { message, code } if invalid
 */
function validateQuizItem(item) {
  if (!item || typeof item !== "object") return { message: "Invalid item", code: "INVALID_ITEM" };
  const type = (item.type === "short-answer") ? "short-answer" : "mcq";
  try {
    if (type === "short-answer") {
      const arr = Array.isArray(item.acceptableAnswers)
        ? item.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean)
        : [];
      if (arr.length < 1) return { message: "acceptableAnswers must have at least 1 entry", code: "INVALID_ACCEPTABLE_ANSWERS" };
      validateShortAnswer({ acceptableAnswers: arr, matchMode: item.matchMode || "contains" });
    } else {
      const choices = Array.isArray(item.choices) ? item.choices.map((c) => String(c).trim()).filter(Boolean) : [];
      if (choices.length < 2 || choices.length > 6) return { message: "MCQ choices must be 2-6", code: "INVALID_MCQ_CHOICES" };
      const correctIndex = Number.isFinite(item.correctIndex) ? item.correctIndex : 0;
      if (correctIndex < 0 || correctIndex >= choices.length) return { message: "correctIndex out of range", code: "INVALID_CORRECT_INDEX" };
      validateMcq({ choices, correctIndex });
    }
    return null;
  } catch (e) {
    return { message: e.message || "Validation failed", code: e.code || "VALIDATION_ERROR" };
  }
}

module.exports = {
  normalizeQuizType,
  parseCsvToQuizItems,
  validateQuizItem,
};
