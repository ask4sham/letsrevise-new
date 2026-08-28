/**
 * Resolve lesson PUT path for editor persist payloads.
 * Admin PUT /api/admin/lessons/:id does not persist quiz — payloads with quiz
 * must use teacher PUT /api/lessons/:id (admins are authorized there).
 */

export function shouldUseTeacherLessonPutForPersistPayload(
  payload: Record<string, unknown> | null | undefined
): boolean {
  return Boolean(payload && typeof payload.quiz === "object" && payload.quiz !== null);
}

export function lessonPersistPutPath(
  lessonId: string,
  payload: Record<string, unknown>,
  isAdmin: boolean
): string {
  if (shouldUseTeacherLessonPutForPersistPayload(payload)) {
    return `/lessons/${lessonId}`;
  }
  if (isAdmin) {
    return `/admin/lessons/${lessonId}`;
  }
  return `/lessons/${lessonId}`;
}
