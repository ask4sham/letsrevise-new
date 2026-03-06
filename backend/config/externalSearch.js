/**
 * PR-021: External search fallback config.
 * PR-035: Live exam context search — AQA, OCR, Edexcel (Pearson), BBC Bitesize, OpenStax, NIH, NHS.
 * Feature-flagged, off by default. Teacher/admin only.
 */

const DEFAULT_EXTERNAL_DOMAINS = [
  "aqa.org.uk",
  "ocr.org.uk",
  "pearson.com",
  "bbc.co.uk",
  "openstax.org",
  "nih.gov",
  "nhs.uk",
];

/** PR-035: Exam board domains for boosting when query suggests exam context. */
const EXAM_BOARD_DOMAINS = ["aqa.org.uk", "ocr.org.uk", "pearson.com"];

function isExternalSearchEnabled() {
  return process.env.AI_TUTOR_EXTERNAL_SEARCH_ENABLED === "true";
}

function getExternalAllowedDomains() {
  const raw = process.env.AI_TUTOR_EXTERNAL_SEARCH_DOMAINS || "";
  const fromEnv = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_EXTERNAL_DOMAINS;
}

function getExternalMaxResults() {
  const n = parseInt(process.env.AI_TUTOR_EXTERNAL_SEARCH_MAX_RESULTS || "5", 10);
  return Math.min(20, Math.max(1, isNaN(n) ? 5 : n));
}

function getExternalMaxSnippetChars() {
  const n = parseInt(process.env.AI_TUTOR_EXTERNAL_SEARCH_MAX_SNIPPET_CHARS || "1200", 10);
  return Math.min(5000, Math.max(200, isNaN(n) ? 1200 : n));
}

/** PR-035: Detect if query suggests exam context (past paper, mark scheme, etc.). */
function isExamContextQuery(query) {
  if (!query || typeof query !== "string") return false;
  const lower = query.trim().toLowerCase();
  const patterns = [
    /\bexam\b/,
    /\bpast\s+paper\b/,
    /\bmark\s+scheme\b/,
    /\b6\s*mark\b/,
    /\bexplain\s+question\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

/** PR-035: When exam context detected, put exam board domains first for better relevance. */
function getDomainsForQuery(query, baseDomains) {
  const doms = Array.isArray(baseDomains) && baseDomains.length > 0 ? baseDomains : getExternalAllowedDomains();
  if (!isExamContextQuery(query)) return doms;
  const examFirst = [...EXAM_BOARD_DOMAINS];
  for (const d of doms) {
    if (!examFirst.includes(d)) examFirst.push(d);
  }
  return examFirst;
}

module.exports = {
  isExternalSearchEnabled,
  getExternalAllowedDomains,
  getExternalMaxResults,
  getExternalMaxSnippetChars,
  isExamContextQuery,
  getDomainsForQuery,
  EXAM_BOARD_DOMAINS,
};
