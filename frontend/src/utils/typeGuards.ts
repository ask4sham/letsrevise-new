import type { LessonResponse } from "../api/lessons";

export function isLessonError(
  r: LessonResponse
): r is Extract<LessonResponse, { ok: false }> {
  return r.ok === false;
}
