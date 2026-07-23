/**
 * Persist Revision practice quiz completion for the same student/lesson/page/set.
 */

import { revisionQuizSetSignature } from "./revisionQuizFreshExclusions";

const STORAGE_PREFIX = "revision-quiz-complete:";

export type RevisionQuizCompletionScope = {
  studentId: string;
  lessonId: string;
  pageId: string;
  setSignature: string;
};

export function buildRevisionQuizCompletionKey(scope: RevisionQuizCompletionScope): string {
  const student = encodeURIComponent(String(scope.studentId || "").trim() || "anon");
  const lesson = encodeURIComponent(String(scope.lessonId || "").trim() || "none");
  const page = encodeURIComponent(String(scope.pageId || "").trim() || "END");
  const sig = encodeURIComponent(String(scope.setSignature || "").trim() || "empty");
  return `${STORAGE_PREFIX}${student}:${lesson}:${page}:${sig}`;
}

export function getRevisionQuizCompleted(scope: RevisionQuizCompletionScope): boolean {
  if (typeof localStorage === "undefined") return false;
  if (!scope.studentId || !scope.lessonId || !scope.setSignature) return false;
  try {
    return localStorage.getItem(buildRevisionQuizCompletionKey(scope)) === "1";
  } catch {
    return false;
  }
}

export function setRevisionQuizCompleted(scope: RevisionQuizCompletionScope, completed: boolean): void {
  if (typeof localStorage === "undefined") return;
  if (!scope.studentId || !scope.lessonId || !scope.setSignature) return;
  try {
    const key = buildRevisionQuizCompletionKey(scope);
    if (completed) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // ignore quota / private mode
  }
}

export function revisionCompletionScopeFromQuestions(params: {
  studentId?: string | null;
  lessonId?: string | null;
  pageId?: string | null;
  questions: Array<Record<string, unknown>>;
}): RevisionQuizCompletionScope | null {
  const studentId = String(params.studentId || "").trim();
  const lessonId = String(params.lessonId || "").trim();
  if (!studentId || !lessonId) return null;
  const setSignature = revisionQuizSetSignature(params.questions || []);
  if (!setSignature || setSignature.endsWith("_0")) return null;
  return {
    studentId,
    lessonId,
    pageId: String(params.pageId || "END").trim() || "END",
    setSignature,
  };
}
