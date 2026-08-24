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

/** Fingerprint normalisation ÔÇö must match backend questionDeduplicationGuard.js exactly. */
export function normalizeQuestionStemForFingerprint(text: string): string {
  return normalizeQuestionStem(text);
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

export const DEFAULT_DUPLICATE_THRESHOLD = 0.85;

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
  return String(q.question ?? q.questionText ?? q.prompt ?? q.stem ?? q.text ?? "").trim();
}

export function correctAnswerFromRecord(q: Record<string, unknown>): string {
  return String(q.correctAnswer ?? q.answer ?? q.modelAnswer ?? "").trim();
}

/** Stable key: normalised stem + correct answer (catches identical MCQ clones). */
export function mcqFingerprintFromStemAndAnswer(stem: string, answer: string): string {
  return `${normalizeQuestionStemForFingerprint(stem)}|${normalizeQuestionStemForFingerprint(answer)}`;
}

/** Stable key: normalised stem + correct answer (catches identical MCQ clones). */
export function mcqFingerprintFromRecord(q: Record<string, unknown>): string {
  return mcqFingerprintFromStemAndAnswer(
    questionStemFromRecord(q),
    correctAnswerFromRecord(q)
  );
}

export function isDuplicateMcqPair(
  a: { question: string; correctAnswer: string },
  b: { question: string; correctAnswer: string },
  threshold = DEFAULT_DUPLICATE_THRESHOLD
): boolean {
  if (isNearDuplicateStem(a.question, b.question, threshold)) return true;
  const caA = normalizeQuestionStem(a.correctAnswer);
  const caB = normalizeQuestionStem(b.correctAnswer);
  if (caA && caB && caA === caB && stemSimilarity(a.question, b.question) >= 0.7) return true;
  return false;
}
