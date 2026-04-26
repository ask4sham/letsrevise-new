/**
 * Inline <span data-key-term="…">…</span> helpers for lesson block content (teacher editor + suggest flow).
 */

export function escapeKeyTermAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeKeyTermVisible(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Same contract as EditLessonPage: attribute = glossary key, body = visible slice in the block. */
export function buildKeyTermSpanHtml(termForLookup: string, visibleSlice: string): string | null {
  let t = termForLookup.trim();
  t = t.replace(/\s+$/g, "");
  t = t.replace(/\s+i$/i, "");
  t = t.trim();
  if (!t) return null;
  if (/[\n\r]/.test(t) || t.includes("<") || t.includes(">")) {
    return null;
  }
  let vis = visibleSlice
    .replace(/\s+$/g, "")
    .replace(/\s+i$/i, "")
    .replace(/^\s+/g, "");
  if (/[\n\r]/.test(vis)) {
    return null;
  }
  return `<span data-key-term="${escapeKeyTermAttr(t)}">${escapeKeyTermVisible(vis)}</span>`;
}

/** Ranges covering full `<span data-key-term=…>…</span>` including tags. */
export function findDataKeyTermSpanRanges(content: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < content.length) {
    const open = content.indexOf("<span", i);
    if (open < 0) break;
    const tagEnd = content.indexOf(">", open);
    if (tagEnd < 0) break;
    const tag = content.slice(open, tagEnd + 1);
    if (!/\bdata-key-term\s*=/.test(tag)) {
      i = open + 1;
      continue;
    }
    const innerStart = tagEnd + 1;
    const close = content.indexOf("</span>", innerStart);
    if (close < 0) break;
    const end = close + "</span>".length;
    ranges.push({ start: open, end });
    i = end;
  }
  return ranges;
}

function matchOverlapsRanges(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((r) => !(end <= r.start || start >= r.end));
}

/** True if [lo, hi) overlaps an existing &lt;span data-key-term&gt;…&lt;/span&gt; (prevents double-wrap). */
export function selectionIntersectsDataKeyTermSpan(
  content: string,
  lo: number,
  hi: number
): boolean {
  if (lo >= hi) return false;
  const ranges = findDataKeyTermSpanRanges(content);
  return matchOverlapsRanges(lo, hi, ranges);
}

/**
 * First occurrence of `term` in `content` not overlapping an existing data-key-term span.
 * Tries case-sensitive match first, then case-insensitive with document casing preserved in `visible`.
 */
export function findFirstUnmarkedTermOccurrence(
  content: string,
  term: string
): { start: number; end: number; visible: string } | null {
  const t = term.trim();
  if (!t) return null;
  const ranges = findDataKeyTermSpanRanges(content);
  const n = t.length;
  for (let i = 0; i <= content.length - n; i++) {
    if (content.slice(i, i + n) !== t) continue;
    if (matchOverlapsRanges(i, i + n, ranges)) continue;
    return { start: i, end: i + n, visible: t };
  }
  const tl = t.toLowerCase();
  for (let i = 0; i <= content.length - n; i++) {
    const slice = content.slice(i, i + n);
    if (slice.toLowerCase() !== tl) continue;
    if (matchOverlapsRanges(i, i + n, ranges)) continue;
    return { start: i, end: i + n, visible: slice };
  }
  return null;
}

/**
 * Merges glossary entries and wraps the first unmarked occurrence per item in order in `content`.
 * Returns updated content and terms that had metadata-only adds (not found in text).
 */
export function applyKeyTermsToBlockContent(
  content: string,
  items: { term: string; definition: string }[]
): { nextContent: string; notFoundTerms: string[] } {
  let c = content;
  const notFoundTerms: string[] = [];
  for (const it of items) {
    const raw = it.term.trim();
    if (!raw) continue;
    const pos = findFirstUnmarkedTermOccurrence(c, raw);
    if (!pos) {
      notFoundTerms.push(raw);
      continue;
    }
    const inner = buildKeyTermSpanHtml(raw, pos.visible);
    if (!inner) continue;
    c = c.slice(0, pos.start) + inner + c.slice(pos.end);
  }
  return { nextContent: c, notFoundTerms };
}
