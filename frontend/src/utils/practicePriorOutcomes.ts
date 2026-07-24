import type { PracticePriorOutcome, PracticeSetItem } from "../api/practiceSets";

export function practiceItemKey(contentType: string, contentId: string): string {
  return `${contentType}:${String(contentId)}`;
}

/** Whether a prior row counts as attempted (unknown score still counts). */
export function isPriorAttempted(row: PracticePriorOutcome | undefined | null): boolean {
  if (!row) return false;
  if (row.attempted === true) return true;
  if (typeof row.isCorrect === "boolean") return true;
  return false;
}

export function buildPriorOutcomeMap(
  priorOutcomes: PracticePriorOutcome[] | undefined | null
): Record<string, PracticePriorOutcome> {
  const map: Record<string, PracticePriorOutcome> = {};
  for (const row of priorOutcomes || []) {
    if (!row?.contentType || row.contentId == null) continue;
    if (!isPriorAttempted(row)) continue;
    const key = practiceItemKey(row.contentType, row.contentId);
    const entry: PracticePriorOutcome = {
      contentType: row.contentType,
      contentId: String(row.contentId),
      attempted: true,
    };
    if (typeof row.isCorrect === "boolean") entry.isCorrect = row.isCorrect;
    map[key] = entry;
  }
  return map;
}

/** First unanswered index in frozen order; returns items.length when all attempted. */
export function firstUnansweredIndex(
  items: PracticeSetItem[],
  priorOutcomes: PracticePriorOutcome[] | undefined | null
): number {
  const map = buildPriorOutcomeMap(priorOutcomes);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!map[practiceItemKey(it.contentType, it.contentId)]?.attempted) {
      return i;
    }
  }
  return items.length;
}

export function allItemsAttempted(
  items: PracticeSetItem[],
  priorOutcomes: PracticePriorOutcome[] | undefined | null
): boolean {
  return items.length > 0 && firstUnansweredIndex(items, priorOutcomes) >= items.length;
}
