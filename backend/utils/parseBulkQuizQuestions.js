/**
 * PR-Q1: Parse bulk quiz question input (JSON, CSV).
 * PR-QUIZ-BANK-TYPES-1: MCQ + short-answer; type column, acceptableAnswers (pipe), matchMode.
 * CSV path uses utils/quizImportFormat (canonical format) for parse + validate, then fingerprint + dedupe here.
 */
const { fingerprintItem, dedupeIncoming } = require("./quizDedupe");
const { normalizeQuizType, validateMcq, validateShortAnswer } = require("./quizQuestionValidation");
const { normalizeDifficulty, normalizeSkill, normalizeEstimatedTimeSec } = require("./metadataValidation");
const { parseCsvToQuizItems } = require("./quizImportFormat");

const MAX_QUESTION = 2000;
const MAX_CHOICES = 6;
const MIN_CHOICES = 2;
const MAX_TAGS = 20;
const MAX_ITEMS = 500;

function parseRow(line, delimiter) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === delimiter || ch === "\t")) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseJson(text, opts = {}) {
  const kind = ["quiz", "assessment"].includes(String(opts.kind || "").toLowerCase()) ? String(opts.kind).toLowerCase() : "quiz";
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error("JSON must be an array");
  return arr.map((c, i) => {
    const itemKind = (c && typeof c.kind === "string" && ["quiz", "assessment"].includes(c.kind.toLowerCase()))
      ? c.kind.toLowerCase()
      : kind;
    const typeRaw = (c && c.type) ? String(c.type).trim().toLowerCase().replace(/\s+/g, "-") : "mcq";
    const type = typeRaw === "short-answer" || typeRaw === "shortanswer" ? "short-answer" : "mcq";
    const rawQ = (c && (typeof c.questionText === "string" || typeof c.question === "string")) ? (c.questionText ?? c.question ?? "") : "";
    const questionText = (rawQ != null ? String(rawQ) : "").trim();
    const choices = Array.isArray(c.choices) ? c.choices.map((x) => String(x).trim()).filter(Boolean) : [];
    const correctIndex = c && typeof c.correctIndex === "number" ? c.correctIndex : (c && typeof c.correctIndex === "string" ? parseInt(c.correctIndex, 10) : 0);
    let acceptableAnswers = [];
    if (Array.isArray(c.acceptableAnswers)) acceptableAnswers = c.acceptableAnswers.map((a) => String(a).trim()).filter(Boolean);
    else if (typeof c.acceptableAnswers === "string") acceptableAnswers = c.acceptableAnswers.split("|").map((a) => a.trim()).filter(Boolean);
    const matchMode = (c && (c.matchMode === "exact" || c.matchMode === "contains")) ? c.matchMode : "contains";
    return {
      type,
      questionText,
      choices,
      correctIndex,
      acceptableAnswers,
      matchMode,
      explanation: (c && typeof c.explanation === "string" ? c.explanation : "").trim(),
      tags: Array.isArray(c.tags) ? c.tags.filter((t) => typeof t === "string").slice(0, MAX_TAGS) : [],
      kind: itemKind,
      difficulty: c && c.difficulty != null ? c.difficulty : undefined,
      skill: c && c.skill != null ? c.skill : undefined,
      estimatedTimeSec: c && c.estimatedTimeSec != null ? c.estimatedTimeSec : undefined,
      _raw: JSON.stringify(c),
      _index: i,
    };
  });
}

function parseCsv(text, options = {}) {
  const kind = ["quiz", "assessment"].includes(String((options || {}).kind || "").toLowerCase())
    ? String(options.kind).toLowerCase()
    : "quiz";
  const lines = (text || "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const delim = options.delimiter || (text.indexOf("\t") >= 0 && (text.match(/\t/g) || []).length >= (text.match(/,/g) || []).length ? "\t" : ",");
  const header = parseRow(lines[0], delim).map((h) => (h || "").toLowerCase());
  const qIdx = header.findIndex((h) => /question/i.test(h));
  const choiceCols = ["choicea", "choiceb", "choicec", "choiced", "choicee", "choicef"];
  const choiceIdxs = choiceCols.map((c) => header.findIndex((h) => h === c || h.replace(/\s/g, "") === c));
  const choicesColIdx = header.findIndex((h) => /^choices?$/i.test(h));
  const correctIdx = header.findIndex((h) => /correct/i.test(h));
  const explIdx = header.findIndex((h) => /explanation/i.test(h));
  const tagsIdx = header.findIndex((h) => /tag/i.test(h));
  const typeIdx = header.findIndex((h) => /^type$/i.test(h));
  const acceptableIdx = header.findIndex((h) => /acceptable/i.test(h));
  const matchModeIdx = header.findIndex((h) => /matchmode|match_mode/i.test(h));
  const diffIdx = header.findIndex((h) => /difficulty/i.test(h));
  const skillIdx = header.findIndex((h) => /^skill$/i.test(h));
  const timeIdx = header.findIndex((h) => /estimatedtime|estimated_time/i.test(h));

  const items = [];
  const defaultType = (options.defaultType === "short-answer") ? "short-answer" : "mcq";
  const start = qIdx >= 0 || choiceIdxs.some((i) => i >= 0) || choicesColIdx >= 0 || typeIdx >= 0 ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cells = parseRow(lines[i], delim);
    const questionText = (qIdx >= 0 ? cells[qIdx] : cells[0] || "").trim();
    const typeCell = typeIdx >= 0 ? String(cells[typeIdx] || "").trim().toLowerCase().replace(/\s+/g, "-") : "";
    const type = (typeCell === "short-answer" || typeCell === "shortanswer") ? "short-answer" : (typeCell ? "mcq" : defaultType);

    let choices = [];
    let correctIndex = 0;
    let acceptableAnswers = [];
    let matchMode = "contains";

    if (type === "short-answer") {
      if (acceptableIdx >= 0 && cells[acceptableIdx]) {
        acceptableAnswers = String(cells[acceptableIdx]).split("|").map((a) => a.trim()).filter(Boolean);
      }
      if (matchModeIdx >= 0 && cells[matchModeIdx]) {
        const m = String(cells[matchModeIdx]).trim().toLowerCase();
        if (m === "exact" || m === "contains") matchMode = m;
      }
    } else {
      if (choicesColIdx >= 0 && cells[choicesColIdx]) {
        choices = String(cells[choicesColIdx]).split(/[|,]/).map((x) => x.trim()).filter(Boolean);
      } else {
        for (const idx of choiceIdxs) {
          if (idx >= 0 && cells[idx]) choices.push(String(cells[idx]).trim());
        }
      }
      if (correctIdx >= 0 && cells[correctIdx]) {
        const v = String(cells[correctIdx]).trim().toUpperCase();
        if (/^[A-F]$/.test(v)) correctIndex = v.charCodeAt(0) - 65;
        else if (/^\d+$/.test(v)) correctIndex = Math.max(0, Math.min(parseInt(v, 10), choices.length - 1));
      }
    }

    const explanation = explIdx >= 0 ? (cells[explIdx] || "").trim() : "";
    let tags = [];
    if (tagsIdx >= 0 && cells[tagsIdx]) {
      tags = String(cells[tagsIdx]).split(/[|,]/).map((x) => x.trim()).filter(Boolean).slice(0, MAX_TAGS);
    }
    const difficulty = diffIdx >= 0 && cells[diffIdx] ? cells[diffIdx].trim() : undefined;
    const skill = skillIdx >= 0 && cells[skillIdx] ? cells[skillIdx].trim() : undefined;
    const estimatedTimeSec = timeIdx >= 0 && cells[timeIdx] ? cells[timeIdx].trim() : undefined;

    items.push({
      type,
      questionText,
      choices,
      correctIndex,
      acceptableAnswers,
      matchMode,
      explanation,
      tags,
      kind,
      difficulty,
      skill,
      estimatedTimeSec,
      _raw: lines[i],
      _index: i,
    });
  }
  return items;
}

function parseBulkInput(format, text, csvOptions = {}) {
  if (!text || typeof text !== "string") return [];
  const t = text.trim();
  if (!t) return [];
  const opts = typeof csvOptions === "object" ? csvOptions : {};
  if (format === "json") return parseJson(t, opts);
  if (format === "csv") return parseCsv(t, opts);
  throw new Error(`Unknown format: ${format}`);
}

function validateItems(items, defaultKind = "quiz") {
  const valid = [];
  const invalid = [];
  const k = ["quiz", "assessment"].includes(String(defaultKind || "").toLowerCase()) ? String(defaultKind).toLowerCase() : "quiz";

  for (let i = 0; i < items.length && valid.length + invalid.length < MAX_ITEMS; i++) {
    const x = items[i];
    const q = (x.questionText || "").trim();
    const itemKind = ["quiz", "assessment"].includes(String(x.kind || "").toLowerCase()) ? String(x.kind).toLowerCase() : k;
    const type = (x.type === "short-answer") ? "short-answer" : "mcq";
    const tags = Array.isArray(x.tags) ? x.tags.filter((t) => typeof t === "string").slice(0, MAX_TAGS) : [];
    const explanation = (x.explanation || "").trim();

    if (!q) {
      invalid.push({ index: x._index ?? i, reason: "Missing questionText", raw: (x._raw || "").slice(0, 100) });
      continue;
    }
    if (q.length > MAX_QUESTION) {
      invalid.push({ index: x._index ?? i, reason: `Question too long (max ${MAX_QUESTION})`, raw: q.slice(0, 80) });
      continue;
    }

    let meta = {};
    try {
      if (x.difficulty != null || x.skill != null || x.estimatedTimeSec != null) {
        meta.difficulty = normalizeDifficulty(x.difficulty);
        meta.skill = normalizeSkill(x.skill);
        meta.estimatedTimeSec = normalizeEstimatedTimeSec(x.estimatedTimeSec);
      }
    } catch (e) {
      invalid.push({ index: x._index ?? i, reason: e.message || "Invalid metadata", raw: (x._raw || "").slice(0, 100) });
      continue;
    }

    if (type === "short-answer") {
      try {
        const sa = validateShortAnswer({ acceptableAnswers: x.acceptableAnswers, matchMode: x.matchMode });
        const item = {
          type: "short-answer",
          questionText: q,
          acceptableAnswers: sa.acceptableAnswers,
          matchMode: sa.matchMode,
          explanation,
          tags,
          kind: itemKind,
          ...meta,
          _index: x._index ?? i,
          _raw: x._raw,
        };
        item.fingerprint = fingerprintItem(item, k);
        valid.push(item);
      } catch (e) {
        invalid.push({ index: x._index ?? i, reason: e.message || "Invalid short-answer", raw: (x._raw || "").slice(0, 100) });
      }
      continue;
    }

    try {
      const choices = Array.isArray(x.choices) ? x.choices.map((c) => String(c).trim()).filter(Boolean) : [];
      const mcq = validateMcq({ choices, correctIndex: x.correctIndex });
      const item = {
        type: "mcq",
        questionText: q,
        choices: mcq.choices,
        correctIndex: mcq.correctIndex,
        explanation,
        tags,
        kind: itemKind,
        ...meta,
        _index: x._index ?? i,
        _raw: x._raw,
      };
      item.fingerprint = fingerprintItem(item, k);
      valid.push(item);
    } catch (e) {
      invalid.push({ index: x._index ?? i, reason: e.message || "Invalid MCQ", raw: (x._raw || "").slice(0, 100) });
    }
  }
  return { valid, invalid };
}

function parseValidateDedupe(format, text, csvOptions = {}) {
  const opts = typeof csvOptions === "object" ? csvOptions : {};

  if (format === "csv") {
    const { items, errors } = parseCsvToQuizItems({
      csvText: text,
      type: opts.defaultType,
    });
    const totalParsed = items.length + errors.length;
    if (totalParsed > MAX_ITEMS) {
      return {
        totalParsed,
        validItems: [],
        invalid: [{ index: -1, reason: `Too many items (max ${MAX_ITEMS})`, raw: "" }],
        duplicatesInPayload: [],
      };
    }
    const kind = ["quiz", "assessment"].includes(String(opts.kind || "").toLowerCase()) ? String(opts.kind).toLowerCase() : "quiz";
    const invalid = errors.map((e) => ({ index: e.row - 1, reason: e.message, raw: (e.raw || "").slice(0, 200) }));
    items.forEach((it) => {
      it.kind = kind;
      it.tags = it.tags || [];
      it.fingerprint = fingerprintItem(it, kind);
    });
    const { uniqueItems, duplicatesInPayload } = dedupeIncoming(items);
    return {
      totalParsed,
      validItems: uniqueItems,
      invalid,
      duplicatesInPayload,
    };
  }

  const raw = parseBulkInput(format, text, opts);
  const totalParsed = raw.length;
  if (raw.length > MAX_ITEMS) {
    return {
      totalParsed,
      validItems: [],
      invalid: [{ index: -1, reason: `Too many items (max ${MAX_ITEMS})`, raw: "" }],
      duplicatesInPayload: [],
    };
  }
  const { valid, invalid } = validateItems(raw);
  const { uniqueItems, duplicatesInPayload } = dedupeIncoming(valid);
  return {
    totalParsed,
    validItems: uniqueItems,
    invalid,
    duplicatesInPayload,
  };
}

function validateBulkItems(rawItems, defaultKind = "quiz") {
  return validateItems(rawItems, defaultKind);
}

module.exports = {
  parseBulkInput,
  validateItems,
  validateBulkItems,
  parseValidateDedupe,
  MAX_ITEMS,
};
