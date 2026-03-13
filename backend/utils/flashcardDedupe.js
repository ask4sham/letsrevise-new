/**
 * PR-FLOW-4: Normalization and dedupe for topic flashcards.
 * Dedupe is by normalized (front, back) within same topicKey, case/whitespace-insensitive.
 */

function normalizeText(s) {
  if (s == null || typeof s !== "string") return "";
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function fingerprint(front, back) {
  const nf = normalizeText(front);
  const nb = normalizeText(back);
  return `${nf}||${nb}`;
}

/**
 * Dedupe incoming items by fingerprint. Returns unique items and list of duplicates (by index).
 * @param {Array<{ front: string; back: string; tags?: string[] }>} items
 * @returns {{ uniqueItems: Array<{ front: string; back: string; tags?: string[] }>; duplicatesInPayload: Array<{ index: number; front: string; back: string }> }}
 */
function dedupeIncoming(items) {
  const seen = new Set();
  const uniqueItems = [];
  const duplicatesInPayload = [];

  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    const front = c && typeof c.front === "string" ? c.front.trim() : "";
    const back = c && typeof c.back === "string" ? c.back.trim() : "";
    const fp = fingerprint(front, back);
    if (seen.has(fp)) {
      duplicatesInPayload.push({ index: i, front, back });
    } else {
      seen.add(fp);
      uniqueItems.push({ ...c, front, back });
    }
  }
  return { uniqueItems, duplicatesInPayload };
}

module.exports = {
  normalizeText,
  fingerprint,
  dedupeIncoming,
};
