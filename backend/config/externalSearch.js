/**
 * PR-021: External search fallback config.
 * Feature-flagged, off by default. Teacher/admin only.
 *
 * Default allowed domains: AQA, OCR, Edexcel, BBC Bitesize, OpenStax, NHS, gov.uk.
 */

const DEFAULT_EXTERNAL_DOMAINS = [
  "aqa.org.uk",
  "ocr.org.uk",
  "qualifications.pearson.com",
  "bbc.co.uk",
  "openstax.org",
  "nhs.uk",
  "gov.uk",
];

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

module.exports = {
  isExternalSearchEnabled,
  getExternalAllowedDomains,
  getExternalMaxResults,
  getExternalMaxSnippetChars,
};
