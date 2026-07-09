/**
 * Specification identity registry — board, level, exam code per specKey.
 * Source of truth for Phase 1 spec-aware routing (curriculum content comes in Phase 2).
 *
 * Universal contract: resolveSpecIdentity works for any registered specKey.
 * Edexcel IGCSE Biology is the first proof case for IGCSE vs GCSE disambiguation.
 */
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");
const { parseTopicKey } = require("../utils/topicKey");

/** Official exam codes keyed by specKey (not stored in all taxonomy JSON files). */
const EXAM_CODES = {
  "aqa-gcse-biology": "8461",
  "aqa-gcse-chemistry": "8462",
  "aqa-gcse-physics": "8463",
  "edexcel-igcse-biology": "4BI1",
};

const EDEXCEL_IGCSE_BIOLOGY = "edexcel-igcse-biology";

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function lessonTextBlob(input = {}) {
  return [input.topicKey, input.title, input.topic, input.subTopic].map(safeStr).filter(Boolean).join(" ");
}

/**
 * Infer Edexcel IGCSE Biology when board/subject match and text or topicKey signals IGCSE.
 * Handles lessons stored with level "GCSE" but topic/title containing IGCSE or exam code 4BI1.
 *
 * @param {{ board?: string, subject?: string, level?: string, topicKey?: string, title?: string, topic?: string, subTopic?: string }} input
 * @returns {string|null}
 */
function inferEdexcelIgcseBiologySpecKey(input = {}) {
  const board = safeStr(input.board).toLowerCase();
  const subject = safeStr(input.subject).toLowerCase();
  if (board !== "edexcel" || subject !== "biology") return null;

  const topicKey = safeStr(input.topicKey);
  if (topicKey.toLowerCase().startsWith(`${EDEXCEL_IGCSE_BIOLOGY}:`)) {
    return EDEXCEL_IGCSE_BIOLOGY;
  }

  if (/^igcse$/i.test(safeStr(input.level))) return EDEXCEL_IGCSE_BIOLOGY;

  const blob = lessonTextBlob(input);
  if (/igcse/i.test(blob) || /\b4bi1\b/i.test(blob)) return EDEXCEL_IGCSE_BIOLOGY;

  return null;
}

/**
 * Map exam board + subject (+ optional level) to specKey.
 * Level disambiguates Edexcel GCSE vs IGCSE Biology.
 * Only returns keys that have loaded taxonomy when the GCSE fallback would invent a missing board.
 */
function boardSubjectToSpecKey(board, subject, level) {
  const b = (board || "").toString().trim().toLowerCase();
  const s = (subject || "").toString().trim().toLowerCase();
  const lv = (level || "").toString().trim().toLowerCase();
  if (!b || !s) return null;
  if (b === "aqa" && s === "biology") return "aqa-gcse-biology";
  if (b === "aqa" && s === "chemistry") return "aqa-gcse-chemistry";
  if (b === "aqa" && s === "physics") return "aqa-gcse-physics";
  if (b === "edexcel" && s === "biology") {
    if (lv === "igcse") return EDEXCEL_IGCSE_BIOLOGY;
    const gcseKey = "edexcel-gcse-biology";
    return getTaxonomyBySpecKey(gcseKey) ? gcseKey : null;
  }
  return `${b}-gcse-${s}`.replace(/\s+/g, "-");
}

/**
 * @param {string} specKey
 * @returns {{ specKey: string, board: string, level: string, subject: string, examCode: string|null }|null}
 */
function getSpecMetadata(specKey) {
  const key = (specKey || "").trim();
  if (!key) return null;
  const taxonomy = getTaxonomyBySpecKey(key);
  if (!taxonomy) return null;
  return {
    specKey: taxonomy.specKey || key,
    board: (taxonomy.examBoard && String(taxonomy.examBoard).trim()) || "",
    level: (taxonomy.level && String(taxonomy.level).trim()) || "",
    subject: (taxonomy.subject && String(taxonomy.subject).trim()) || "",
    examCode: EXAM_CODES[key] || taxonomy.examCode || null,
  };
}

function normalizeLevelLabel(level) {
  const s = (level || "").toString().trim();
  if (!s) return "";
  if (/ks\s*3/i.test(s)) return "KS3";
  if (/igcse/i.test(s)) return "IGCSE";
  if (/gcse/i.test(s)) return "GCSE";
  if (/a[\s-]?level/i.test(s)) return "A-Level";
  return s;
}

/**
 * Resolve canonical spec identity for generation / lesson save.
 * Priority: namespaced topicKey → explicit specKey → IGCSE text inference → board+subject+level.
 * Registry metadata wins over mismatched request body when specKey is known.
 *
 * @param {{ topicKey?: string|null, specKey?: string|null, board?: string, subject?: string, level?: string, title?: string, topic?: string, subTopic?: string }} input
 */
function resolveSpecIdentity(input = {}) {
  const topicKey = typeof input.topicKey === "string" ? input.topicKey.trim() : "";
  const bodySpecKey = typeof input.specKey === "string" ? input.specKey.trim() : "";
  const board = typeof input.board === "string" ? input.board.trim() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const level = typeof input.level === "string" ? input.level.trim() : "";

  const parsed = topicKey ? parseTopicKey(topicKey) : { specKey: null, isNamespaced: false };
  const resolvedSpecKey =
    (parsed.isNamespaced && parsed.specKey) ||
    bodySpecKey ||
    inferEdexcelIgcseBiologySpecKey({
      board,
      subject,
      level,
      topicKey,
      title: input.title,
      topic: input.topic,
      subTopic: input.subTopic,
    }) ||
    boardSubjectToSpecKey(board, subject, level) ||
    null;

  const meta = resolvedSpecKey ? getSpecMetadata(resolvedSpecKey) : null;

  return {
    specKey: resolvedSpecKey,
    board: meta?.board || board || "",
    level: normalizeLevelLabel(meta?.level || level),
    examCode: meta?.examCode || null,
    subject: meta?.subject || subject || "",
  };
}

module.exports = {
  EXAM_CODES,
  boardSubjectToSpecKey,
  getSpecMetadata,
  resolveSpecIdentity,
  normalizeLevelLabel,
  inferEdexcelIgcseBiologySpecKey,
};
