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
  const ms = Array.isArray(parts.markScheme)
    ? parts.markScheme.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  if (ms.length === 1) chunks.push(ms[0]);
  else if (ms.length > 1) chunks.push(ms.map((line, i) => `${i + 1}. ${line}`).join("\n"));
  const merged = chunks.join("\n\n").trim();
  return merged || undefined;
}
