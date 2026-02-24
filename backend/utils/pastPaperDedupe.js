const crypto = require("crypto");

function normalizeText(v) {
  return String(v || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pastPaperFingerprint({ specKey, examBoard, level, year, series, paperCode, tier }) {
  const payload = {
    specKey: normalizeText(specKey),
    examBoard: normalizeText(examBoard),
    level: normalizeText(level),
    year: normalizeText(year),
    series: normalizeText(series),
    paperCode: normalizeText(paperCode),
    tier: normalizeText(tier),
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Fingerprint for URL-based topic past paper (same URL = same fingerprint). */
function fingerprintUrl(item) {
  const url = (item && item.url != null) ? String(item.url).trim() : "";
  return crypto.createHash("sha256").update(url || "no-url").digest("hex");
}

/** Fingerprint for file-based topic past paper (same sha256 = same fingerprint). */
function fingerprintFile(item) {
  const sha = (item && item.sha256 != null) ? String(item.sha256).trim() : "";
  const title = (item && item.title != null) ? String(item.title).trim() : "";
  return crypto.createHash("sha256").update(sha || title || "no-file").digest("hex");
}

/**
 * Dedupe incoming items by fingerprint. Adds .fingerprint to each item.
 * @param {Array<object>} items
 * @param {function(object): string} fingerprintFn
 * @returns {{ uniqueItems: Array<object>, duplicatesInPayload: Array<{ index: number }> }}
 */
function dedupeIncoming(items, fingerprintFn) {
  const seen = new Set();
  const uniqueItems = [];
  const duplicatesInPayload = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const fp = typeof fingerprintFn === "function" ? fingerprintFn(it) : "";
    if (seen.has(fp)) {
      duplicatesInPayload.push({ index: i });
    } else {
      seen.add(fp);
      uniqueItems.push({ ...it, fingerprint: fp });
    }
  }
  return { uniqueItems, duplicatesInPayload };
}

module.exports = {
  pastPaperFingerprint,
  fingerprintUrl,
  fingerprintFile,
  dedupeIncoming,
};
