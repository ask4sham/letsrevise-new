import { markShortAnswer, checkContradiction } from "./shortAnswerMarking";

export interface GradeShortAnswerResult {
  score: number;
  maxMarks: number;
  hits: string[];
  missing?: string[];
  contradictionFeedback?: string;
}

export type ShortAnswerFeedbackStatus = "correct" | "partial" | "incorrect";

export function deriveShortAnswerFeedbackStatus(
  score: number,
  maxMarks: number
): ShortAnswerFeedbackStatus {
  const max = Math.max(1, maxMarks || 1);
  const s = Math.max(0, score || 0);
  if (s >= max) return "correct";
  if (s > 0) return "partial";
  return "incorrect";
}

export function gradeShortAnswer({
  userAnswer,
  markScheme,
  correctAnswer,
  marks,
}: {
  userAnswer: string;
  markScheme?: string[];
  correctAnswer?: string;
  marks: number;
}): GradeShortAnswerResult {
  const norm = (s = "") =>
    String(s).toLowerCase().replace(/'/g, "").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  const ua = norm(userAnswer);
  const maxMarks = Math.max(1, marks || 1);

  let effectiveMarkScheme = Array.isArray(markScheme) ? markScheme : [];
  if (!effectiveMarkScheme.length && (correctAnswer || "").trim()) {
    const ca = (correctAnswer || "").replace(/\r\n/g, "\n").trim();
    const parts = ca
      .split(/\n+|;|\.| and | but | whereas /i)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 10);
    effectiveMarkScheme = parts.length ? parts : [ca];
  }

  const acceptableAnswers = effectiveMarkScheme.length
    ? effectiveMarkScheme
    : correctAnswer
      ? [correctAnswer]
      : [];

  if (acceptableAnswers.length > 0 && ua) {
    const contradiction = checkContradiction(userAnswer, acceptableAnswers);
    if (contradiction.isContradiction) {
      const feedback = contradiction.negatedConcept
        ? `Your answer contradicts the key marking point. The expected idea includes "${contradiction.negatedConcept}" in a positive sense.`
        : "Your answer contradicts the key marking point.";
      return { score: 0, maxMarks, hits: [], contradictionFeedback: feedback };
    }
  }

  if (!effectiveMarkScheme.length && acceptableAnswers.length > 0) {
    const result = markShortAnswer(userAnswer, acceptableAnswers, {
      overlapThreshold: 0.45,
      requireConceptMatch: true,
    });
    if (!result.correct) {
      const feedback =
        result.reason === "no_concept_match"
          ? "Your answer does not include the key concept(s) required."
          : result.reason === "contradiction"
            ? "Your answer contradicts the key marking point."
            : undefined;
      return { score: 0, maxMarks, hits: [], contradictionFeedback: feedback };
    }
    return { score: maxMarks, maxMarks, hits: ["keyword match"] };
  }

  if (effectiveMarkScheme.length) {
    const stop = new Set([
      "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
      "is", "are", "was", "were", "be", "being", "been", "that", "this", "these", "those", "it", "its", "as", "at", "by", "from",
    ]);

    const words = ua.split(" ").filter(Boolean);
    const levenshtein = (a: string, b: string) => {
      const m = a.length;
      const n = b.length;
      const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
          );
        }
      }
      return dp[m][n];
    };

    const approxHas = (target: string) => {
      const t = norm(target);
      if (!t) return false;
      if (ua.includes(t)) return true;
      return words.some((w) => levenshtein(w, t) <= 2);
    };

    const matchedPoints: string[] = [];
    const missingPoints: string[] = [];

    for (const point of effectiveMarkScheme) {
      const p = (point || "").trim();
      if (!p) continue;
      const tokens = norm(p).split(" ").filter((t) => t && !stop.has(t));
      const ok = tokens.some((t) => approxHas(t));
      if (ok) matchedPoints.push(p);
      else missingPoints.push(p);
    }

    const score = Math.min(matchedPoints.length, maxMarks);
    return { score, maxMarks, hits: matchedPoints, missing: missingPoints };
  }

  return { score: 0, maxMarks, hits: [] };
}

export function buildShortAnswerImprovementTip(result: GradeShortAnswerResult): string | undefined {
  const missing = (result.missing || []).map((line) => String(line ?? "").trim()).filter(Boolean);
  if (missing.length > 0) {
    return `Try to include: ${missing[0]}`;
  }
  if (result.contradictionFeedback) {
    return "Check that your answer states the key idea positively, without contradicting the mark scheme.";
  }
  if (result.score < result.maxMarks) {
    return "Compare your answer with the model answer and mark scheme points.";
  }
  return undefined;
}
