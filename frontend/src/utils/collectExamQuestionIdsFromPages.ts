/** Collect examQuestionId values from lesson pages (reference-only blocks). */
export function collectExamQuestionIdsFromPages(
  pages: Array<{ blocks?: Array<{ type?: string; examQuestionId?: string }> }> | undefined
): string[] {
  const ids = new Set<string>();
  for (const page of pages ?? []) {
    for (const block of page?.blocks ?? []) {
      if (String(block?.type ?? "").trim() !== "examQuestion") continue;
      const raw = block?.examQuestionId;
      if (!raw) continue;
      const id = String(raw).trim();
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}
