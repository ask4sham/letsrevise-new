/**
 * Pure helpers for LessonViewPage embedded-exam cache / refresh lifecycle.
 */

/** Stable cache key for a set of embedded exam question ids. */
export function embeddedExamQuestionIdsKey(ids: string[]): string {
  return [...ids].sort().join("|");
}

/** Same route id with lesson already loaded — background refresh, not cold load. */
export function isSameLessonRouteRefresh(
  routeLessonId: string | undefined,
  loadedLessonId: string | null | undefined
): boolean {
  if (!routeLessonId || !loadedLessonId) return false;
  return String(routeLessonId) === String(loadedLessonId);
}

/** Lesson document matches the current route id (guards stale lesson during navigation). */
export function lessonMatchesRoute(
  routeLessonId: string | undefined,
  lesson: { id?: string } | null | undefined
): boolean {
  if (!routeLessonId || !lesson?.id) return false;
  return String(routeLessonId) === String(lesson.id);
}

/**
 * Clear embedded exam cache when the id set changes or route has no lesson / no embedded ids.
 * Does NOT clear when lesson is temporarily null during same-id refresh.
 */
export function shouldClearEmbeddedExamCache(args: {
  routeLessonId: string | undefined;
  previousExamIdsKey: string;
  nextExamIds: string[];
}): boolean {
  const { routeLessonId, previousExamIdsKey, nextExamIds } = args;
  if (!routeLessonId) return true;
  const nextKey = embeddedExamQuestionIdsKey(nextExamIds);
  if (!nextExamIds.length) return previousExamIdsKey !== "";
  if (!previousExamIdsKey) return false;
  return previousExamIdsKey !== nextKey;
}
