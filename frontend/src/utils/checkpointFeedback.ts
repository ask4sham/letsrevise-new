import { parseDifficultyFromMarkScheme } from "./checkpointDifficulty";

/** Rubric lines for checkpoint/self-check blocks (`markScheme` may be string[] or legacy string). */
export function checkpointMarkSchemeLines(
  markScheme?: string | string[] | null | undefined,
  maxLines = 20
): string[] {
  if (markScheme == null) return [];
  if (Array.isArray(markScheme)) {
    return markScheme
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, maxLines);
  }
  if (typeof markScheme === "string" && markScheme.trim()) {
    return markScheme
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, maxLines);
  }
  return [];
}

/** One-line-per-bullet text for checkpoint mark-scheme editors. */
export function checkpointMarkSchemeEditorText(
  markScheme?: string | string[] | null | undefined
): string {
  return checkpointMarkSchemeLines(markScheme).join("\n");
}

/**
 * Merge free-text checkpoint explanation with mark-scheme bullet points for student display.
 * Non-breaking: empty inputs yield undefined.
 */
export function mergeCheckpointExplanationParts(parts: {
  explanation?: string | null | undefined;
  markScheme?: string[] | null | undefined;
}): string | undefined {
  const chunks: string[] = [];
  const rawExp =
    typeof parts.explanation === "string" ? parts.explanation.replace(/\r\n/g, "\n").trim() : "";
  if (rawExp) chunks.push(rawExp);
  const { markScheme: ms } = parseDifficultyFromMarkScheme(parts.markScheme);
  if (ms.length === 1) chunks.push(ms[0]);
  else if (ms.length > 1) chunks.push(ms.map((line, i) => `${i + 1}. ${line}`).join("\n"));
  const merged = chunks.join("\n\n").trim();
  return merged || undefined;
}

/** True when practice `explanation` repeats mark-scheme content (common in bank API payloads). */
export function isPracticeExplanationRedundant(
  explanation?: string | null,
  markScheme?: string[] | null
): boolean {
  const exp = typeof explanation === "string" ? explanation.replace(/\r\n/g, "\n").trim() : "";
  const lines = checkpointMarkSchemeLines(markScheme);
  if (!exp) return true;
  if (!lines.length) return false;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const expNorm = norm(exp);
  const flatScheme = norm(lines.join(" "));

  if (expNorm === flatScheme) return true;
  if (exp.replace(/\r\n/g, "\n").trim() === lines.join("\n")) return true;

  const numbered = lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
  if (exp.replace(/\r\n/g, "\n").trim() === numbered) return true;

  const allLinesPresent = lines.every((line) => expNorm.includes(norm(line)));
  if (allLinesPresent && expNorm.length <= flatScheme.length * 1.25 + 12) return true;

  return false;
}
