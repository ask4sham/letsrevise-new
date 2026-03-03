/**
 * PR-FLOW-4: Parse bulk flashcard input (JSON, newline, CSV).
 */
const { fingerprint, dedupeIncoming } = require("./flashcardDedupe");

const MAX_FRONT = 500;
const MAX_BACK = 5000; // spec suggests 5000; model has 2000 for back - we validate len on commit
const MAX_TAGS = 20;
const MAX_ITEMS = 500;

// Newline separators: " :: ", " — ", " -> "
const NEWLINE_SEPS = [/\s*::\s*/, /\s*—\s*/, /\s*->\s*/];

function parseNewline(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let front = "";
    let back = "";
    for (const sep of NEWLINE_SEPS) {
      const m = line.match(sep);
      if (m) {
        const idx = line.indexOf(m[0]);
        front = line.slice(0, idx).trim();
        back = line.slice(idx + m[0].length).trim();
        break;
      }
    }
    if (!front && !back && line.includes("\t")) {
      const parts = line.split(/\t/);
      front = (parts[0] || "").trim();
      back = (parts[1] || "").trim();
    }
    items.push({ front, back, _raw: line, _index: i });
  }
  return items;
}

function parseJson(text) {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error("JSON must be an array");
  return arr.map((c, i) => ({
    front: (c && typeof c.front === "string" ? c.front : "").trim(),
    back: (c && typeof c.back === "string" ? c.back : "").trim(),
    tags: Array.isArray(c.tags) ? c.tags.filter((t) => typeof t === "string").slice(0, MAX_TAGS) : [],
    _raw: JSON.stringify(c),
    _index: i,
  }));
}

/**
 * Normalize CSV header for column matching: trim, lowercase, collapse spaces, remove parens.
 * Enables "Question (Paraphrased)" -> "questionparaphrased", "Answer" -> "answer".
 */
function normalizeHeaderForCsv(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
}

const FRONT_ALIASES = new Set(["front", "question", "questionparaphrased"]);
const BACK_ALIASES = new Set(["back", "answer"]);

/**
 * Minimal CSV parser: handles quoted fields, auto-detect delimiter (tab vs comma).
 */
function parseCsv(text, options = {}) {
  const delimiter = options.delimiter || (text.indexOf("\t") >= 0 && text.split("\t").length > text.split(",").length ? "\t" : ",");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const parseRow = (line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && (ch === delimiter || ch === "\t")) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const header = parseRow(lines[0]);
  const headerNorm = header.map(normalizeHeaderForCsv);
  const frontIdx = headerNorm.findIndex((h) => FRONT_ALIASES.has(h));
  const backIdx = headerNorm.findIndex((h) => BACK_ALIASES.has(h));
  const tagsIdx = header.findIndex((h) => /tag/i.test(String(h).trim()));
  const hasHeader = frontIdx >= 0 || backIdx >= 0 || FRONT_ALIASES.has(headerNorm[0]) || BACK_ALIASES.has(headerNorm[0]);

  const items = [];
  const start = hasHeader ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const front = frontIdx >= 0 ? (cells[frontIdx] || "").trim() : (cells[0] || "").trim();
    const back = backIdx >= 0 ? (cells[backIdx] || "").trim() : (cells[1] || "").trim();
    let tags = [];
    if (tagsIdx >= 0 && cells[tagsIdx]) {
      const t = cells[tagsIdx];
      tags = t.split(/[|,]/).map((x) => x.trim()).filter(Boolean).slice(0, MAX_TAGS);
    }
    items.push({ front, back, tags, _raw: lines[i], _index: i });
  }
  return items;
}

/**
 * Parse by format, return raw items with _raw and _index.
 */
function parseBulkInput(format, text, csvOptions = {}) {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (format === "json") return parseJson(trimmed);
  if (format === "newline") return parseNewline(trimmed);
  if (format === "csv") return parseCsv(trimmed, csvOptions);
  throw new Error(`Unknown format: ${format}`);
}

/**
 * Validate and normalize items; return { valid, invalid }.
 */
function validateItems(items) {
  const valid = [];
  const invalid = [];

  for (let i = 0; i < items.length && valid.length + invalid.length < MAX_ITEMS; i++) {
    const x = items[i];
    const front = (x.front || "").trim();
    const back = (x.back || "").trim();
    if (!front) {
      invalid.push({ index: x._index ?? i, reason: "Missing front", raw: (x._raw || "").slice(0, 100) });
      continue;
    }
    if (!back) {
      invalid.push({ index: x._index ?? i, reason: "Missing back", raw: (x._raw || "").slice(0, 100) });
      continue;
    }
    if (front.length > MAX_FRONT) {
      invalid.push({ index: x._index ?? i, reason: `Front too long (max ${MAX_FRONT})`, raw: front.slice(0, 80) });
      continue;
    }
    if (back.length > MAX_BACK) {
      invalid.push({ index: x._index ?? i, reason: `Back too long (max ${MAX_BACK})`, raw: back.slice(0, 80) });
      continue;
    }
    const tags = Array.isArray(x.tags) ? x.tags.filter((t) => typeof t === "string").slice(0, MAX_TAGS) : [];
    const topic = (x.topic != null && String(x.topic).trim()) ? String(x.topic).trim() : undefined;
    valid.push({ front, back, tags, fingerprint: fingerprint(front, back), topic });
  }

  return { valid, invalid };
}

/**
 * Full pipeline: parse -> validate -> dedupe.
 * Returns { totalParsed, validItems, invalid, duplicatesInPayload }.
 */
function parseValidateDedupe(format, text, csvOptions = {}) {
  const raw = parseBulkInput(format, text, csvOptions);
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

function validateBulkItems(rawItems) {
  return validateItems(rawItems);
}

module.exports = {
  parseBulkInput,
  validateItems,
  validateBulkItems,
  parseValidateDedupe,
  MAX_ITEMS,
  MAX_FRONT,
  MAX_BACK,
};
