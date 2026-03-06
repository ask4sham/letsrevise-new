/**
 * Short-answer marking with negation-aware contradiction detection.
 * PR-TRUST: Do NOT award marks when the student answer contradicts the expected concept.
 * Deterministic, rule-based — mirrors backend/utils/shortAnswerMarking.js
 */

const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "of", "to", "in", "on", "for", "with", "cells", "cell", "it", "its",
]);

const NEGATION_PHRASES = [
  "no", "not", "dont", "don't", "doesnt", "doesn't", "didnt", "didn't",
  "cant", "can't", "cannot", "wont", "won't",
  "without", "lack", "lacks", "lacking", "lacks a", "has no", "hasnt",
  "missing", "absent", "neither", "nor",
];

function normalise(s = ""): string {
  return String(s)
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractConceptTokens(text: string): string[] {
  return normalise(text)
    .split(" ")
    .filter(Boolean)
    .filter((t) => t.length > 1)
    .filter((t) => !STOP.has(t));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function getKeyConceptTokens(acceptableAnswers: string | string[]): string[] {
  const sources = Array.isArray(acceptableAnswers)
    ? acceptableAnswers
    : [String(acceptableAnswers || "")];
  const allTokens = new Set<string>();
  for (const s of sources) {
    const tokens = extractConceptTokens(s);
    for (const t of tokens) {
      if (t.length >= 3 && !STOP.has(t)) allTokens.add(t);
    }
  }
  return Array.from(allTokens);
}

function detectContradiction(
  studentAnswer: string,
  keyConceptTokens: string[]
): { contradiction: boolean; negatedConcept?: string } {
  if (!keyConceptTokens?.length) return { contradiction: false };

  const norm = normalise(studentAnswer);
  const words = norm.split(" ").filter(Boolean);
  if (words.length === 0) return { contradiction: false };

  const negSet = new Set(NEGATION_PHRASES);

  for (const concept of keyConceptTokens) {
    const conceptLower = concept.toLowerCase().trim();
    if (!conceptLower) continue;

    const idx = words.findIndex((w) => w === conceptLower || levenshtein(w, conceptLower) <= 1);
    if (idx === -1) continue;

    const window = 3;
    const start = Math.max(0, idx - window);
    const end = Math.min(words.length - 1, idx + window);

    for (let i = start; i <= end; i++) {
      const w = words[i];
      if (negSet.has(w)) return { contradiction: true, negatedConcept: concept };
      if (i < words.length - 1) {
        const twoWord = `${w} ${words[i + 1]}`.toLowerCase();
        if (twoWord === "does not" || twoWord === "do not" || twoWord === "has no" || twoWord === "have no") {
          return { contradiction: true, negatedConcept: concept };
        }
      }
    }
  }
  return { contradiction: false };
}

export function checkContradiction(
  studentAnswer: string,
  acceptableAnswers: string | string[]
): { isContradiction: boolean; negatedConcept?: string } {
  const keyConcepts = getKeyConceptTokens(acceptableAnswers);
  const result = detectContradiction(studentAnswer, keyConcepts);
  return { isContradiction: result.contradiction, negatedConcept: result.negatedConcept };
}

function fuzzyHasToken(userTokens: string[], target: string): boolean {
  const t = target.toLowerCase();
  return userTokens.some((u) => u === t || levenshtein(u, t) <= 1);
}

export interface MarkShortAnswerResult {
  correct: boolean;
  reason?: "contradiction" | "no_concept_match" | "low_overlap" | "no_model_answer" | "empty";
  negatedConcept?: string;
  overlap?: number;
}

export function markShortAnswer(
  studentAnswer: string,
  acceptableAnswers: string | string[],
  opts: { overlapThreshold?: number; requireConceptMatch?: boolean } = {}
): MarkShortAnswerResult {
  const { overlapThreshold = 0.5, requireConceptMatch = true } = opts;

  const sources = Array.isArray(acceptableAnswers)
    ? acceptableAnswers
    : [String(acceptableAnswers || "")].filter(Boolean);

  if (sources.length === 0) return { correct: false, reason: "no_model_answer" };

  const normStudent = normalise(studentAnswer);
  if (!normStudent) return { correct: false, reason: "empty" };

  const uTokens = extractConceptTokens(studentAnswer);
  const keyConcepts = getKeyConceptTokens(sources);

  const contradiction = checkContradiction(studentAnswer, sources);
  if (contradiction.isContradiction) {
    return { correct: false, reason: "contradiction", negatedConcept: contradiction.negatedConcept };
  }

  if (requireConceptMatch && keyConcepts.length > 0) {
    const hasConcept = keyConcepts.some((c) => fuzzyHasToken(uTokens, c));
    if (!hasConcept) return { correct: false, reason: "no_concept_match" };
  }

  const allCTokens = new Set<string>();
  for (const s of sources) {
    extractConceptTokens(s).forEach((t) => allCTokens.add(t));
  }

  let hit = 0;
  for (const ct of Array.from(allCTokens)) {
    if (fuzzyHasToken(uTokens, ct)) hit++;
  }
  const overlap = hit / Math.max(1, allCTokens.size);

  if (overlap < overlapThreshold) return { correct: false, reason: "low_overlap", overlap };

  return { correct: true };
}
