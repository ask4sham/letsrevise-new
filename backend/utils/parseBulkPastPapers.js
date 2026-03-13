/**
 * PR-PP1: Parse bulk past paper URL import (JSON, CSV).
 */
const { fingerprintUrl, dedupeIncoming } = require("./pastPaperDedupe");

const MAX_TITLE = 300;
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

function isValidUrl(s) {
  if (!s || typeof s !== "string") return false;
  const trimmed = s.trim();
  return /^https?:\/\/[^\s]+$/i.test(trimmed);
}

function parseJson(text) {
  const arr = JSON.parse(text);
  if (!Array.isArray(arr)) throw new Error("JSON must be an array");
  return arr.map((c, i) => ({
    title: (c && typeof c.title === "string" ? c.title : "").trim(),
    url: (c && typeof c.url === "string" ? c.url : "").trim(),
    examBoard: (c?.examBoard && typeof c.examBoard === "string" ? c.examBoard : "").trim(),
    qualification: (c?.qualification && typeof c.qualification === "string" ? c.qualification : "").trim(),
    subject: (c?.subject && typeof c.subject === "string" ? c.subject : "").trim(),
    year: c?.year != null && Number.isFinite(Number(c.year)) ? Number(c.year) : undefined,
    paper: (c?.paper && typeof c.paper === "string" ? c.paper : "").trim(),
    session: (c?.session && typeof c.session === "string" ? c.session : "").trim(),
    tier: (c?.tier && typeof c.tier === "string" ? c.tier : "").trim(),
    type: (c?.type && typeof c.type === "string" ? c.type : "").trim(),
    tags: Array.isArray(c?.tags) ? c.tags.filter((t) => typeof t === "string").slice(0, MAX_TAGS) : [],
    _raw: JSON.stringify(c),
    _index: i,
  }));
}

function parseCsv(text, options = {}) {
  const lines = (text || "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const delim = options.delimiter || (text.indexOf("\t") >= 0 && (text.match(/\t/g) || []).length >= (text.match(/,/g) || []).length ? "\t" : ",");
  const header = parseRow(lines[0], delim).map((h) => (h || "").toLowerCase());
  const titleIdx = header.findIndex((h) => /title/i.test(h));
  const urlIdx = header.findIndex((h) => /^url$/i.test(h) || /^link$/i.test(h));
  const examBoardIdx = header.findIndex((h) => /exam|board/i.test(h));
  const qualIdx = header.findIndex((h) => /qualification/i.test(h));
  const subjectIdx = header.findIndex((h) => /subject/i.test(h));
  const yearIdx = header.findIndex((h) => /year/i.test(h));
  const paperIdx = header.findIndex((h) => /^paper$/i.test(h));
  const sessionIdx = header.findIndex((h) => /session/i.test(h));
  const tierIdx = header.findIndex((h) => /tier/i.test(h));
  const typeIdx = header.findIndex((h) => /^type$/i.test(h));
  const tagsIdx = header.findIndex((h) => /tag/i.test(h));

  const items = [];
  const start = titleIdx >= 0 || urlIdx >= 0 ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const cells = parseRow(lines[i], delim);
    const title = (titleIdx >= 0 ? cells[titleIdx] : cells[0] || "").trim();
    const url = (urlIdx >= 0 ? cells[urlIdx] : cells[1] || "").trim();
    let tags = [];
    if (tagsIdx >= 0 && cells[tagsIdx]) {
      tags = String(cells[tagsIdx])
        .split(/[|,]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, MAX_TAGS);
    }
    items.push({
      title,
      url,
      examBoard: examBoardIdx >= 0 ? (cells[examBoardIdx] || "").trim() : "",
      qualification: qualIdx >= 0 ? (cells[qualIdx] || "").trim() : "",
      subject: subjectIdx >= 0 ? (cells[subjectIdx] || "").trim() : "",
      year: yearIdx >= 0 && cells[yearIdx] && /^\d+$/.test(String(cells[yearIdx]).trim()) ? parseInt(String(cells[yearIdx]).trim(), 10) : undefined,
      paper: paperIdx >= 0 ? (cells[paperIdx] || "").trim() : "",
      session: sessionIdx >= 0 ? (cells[sessionIdx] || "").trim() : "",
      tier: tierIdx >= 0 ? (cells[tierIdx] || "").trim() : "",
      type: typeIdx >= 0 ? (cells[typeIdx] || "").trim() : "",
      tags,
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
  if (format === "json") return parseJson(t);
  if (format === "csv") return parseCsv(t, csvOptions);
  throw new Error(`Unknown format: ${format}`);
}

function validateItems(items) {
  const valid = [];
  const invalid = [];

  for (let i = 0; i < items.length && valid.length + invalid.length < MAX_ITEMS; i++) {
    const x = items[i];
    const title = (x.title || "").trim();
    const url = (x.url || "").trim();

    if (!title) {
      invalid.push({ index: x._index ?? i, reason: "Missing title", raw: (x._raw || "").slice(0, 100) });
      continue;
    }
    if (title.length > MAX_TITLE) {
      invalid.push({ index: x._index ?? i, reason: `Title too long (max ${MAX_TITLE})`, raw: title.slice(0, 80) });
      continue;
    }
    if (!isValidUrl(url)) {
      invalid.push({ index: x._index ?? i, reason: "Invalid or missing URL (must be http/https)", raw: url.slice(0, 80) });
      continue;
    }
    const tags = Array.isArray(x.tags) ? x.tags.filter((t) => typeof t === "string").slice(0, MAX_TAGS) : [];
    valid.push({
      title,
      url,
      examBoard: (x.examBoard || "").trim(),
      qualification: (x.qualification || "").trim(),
      subject: (x.subject || "").trim(),
      year: x.year != null && Number.isFinite(Number(x.year)) ? Number(x.year) : undefined,
      paper: (x.paper || "").trim(),
      session: (x.session || "").trim(),
      tier: (x.tier || "").trim(),
      type: (x.type || "").trim(),
      tags,
    });
  }
  return { valid, invalid };
}

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
  const { uniqueItems, duplicatesInPayload } = dedupeIncoming(valid, fingerprintUrl);
  return {
    totalParsed,
    validItems: uniqueItems,
    invalid,
    duplicatesInPayload,
  };
}

module.exports = {
  parseBulkInput,
  validateItems,
  parseValidateDedupe,
  MAX_ITEMS,
};
