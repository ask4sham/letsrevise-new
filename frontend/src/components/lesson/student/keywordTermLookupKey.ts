/**
 * Stable key for matching a clicked/highlighted term to `metadata.contentKeywords[]`
 * (case, spacing, Unicode, invisible chars). Shared by span resolution and glossary lookup.
 */
export function keywordTermLookupKey(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
