/**
 * Normalise and compare question stems to avoid repeating checkpoint prompts in revision practice.
 */

export function normalizeQuestionStem(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[.,?!;:'"()[\]{}\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  const norm = normalizeQuestionStem(text);
  const tokens = norm.split(" ").filter((t) => t.length > 2);
  return new Set(tokens);
}

/** Jaccard similarity on word tokens (0–1). */
export function stemSimilarity(a: string, b: string): number {
  const na = normalizeQuestionStem(a);
  const nb = normalizeQuestionStem(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter += 1;
  });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

const DEFAULT_DUPLICATE_THRESHOLD = 0.82;

export function isNearDuplicateStem(
  a: string,
  b: string,
  threshold = DEFAULT_DUPLICATE_THRESHOLD
): boolean {
  const na = normalizeQuestionStem(a);
  const nb = normalizeQuestionStem(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 12 && nb.length >= 12 && (na.includes(nb) || nb.includes(na))) return true;
  return stemSimilarity(a, b) >= threshold;
}

export function questionStemFromRecord(q: Record<string, unknown>): string {
  return String(q.question ?? q.prompt ?? q.stem ?? q.text ?? "").trim();
}
