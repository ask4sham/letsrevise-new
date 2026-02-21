/**
 * PR-PP1: Fingerprint and dedupe for topic past papers.
 */

function normalizeText(s) {
  if (s == null || typeof s !== "string") return "";
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function fingerprintUrl(item) {
  const nt = (x) => normalizeText(x);
  return [
    nt(item.title),
    item.year != null ? String(item.year) : "",
    nt(item.paper),
    nt(item.session),
    nt(item.tier),
    nt(item.type),
    nt(item.url),
  ].join("||");
}

function fingerprintFile(item) {
  const nt = (x) => normalizeText(x);
  const sha = item.sha256 || item.file?.sha256 || "";
  return [
    nt(item.title),
    item.year != null ? String(item.year) : "",
    nt(item.paper),
    nt(item.session),
    nt(item.tier),
    nt(item.type),
    sha,
  ].join("||");
}

function dedupeIncoming(items, fingerprintFn) {
  const seen = new Set();
  const uniqueItems = [];
  const duplicatesInPayload = [];
  for (let i = 0; i < items.length; i++) {
    const fp = fingerprintFn(items[i]);
    if (seen.has(fp)) {
      duplicatesInPayload.push({ index: i, ...items[i] });
    } else {
      seen.add(fp);
      uniqueItems.push({ ...items[i], fingerprint: fp });
    }
  }
  return { uniqueItems, duplicatesInPayload };
}

module.exports = {
  normalizeText,
  fingerprintUrl,
  fingerprintFile,
  dedupeIncoming,
};
