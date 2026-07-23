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

/** Versioned completion payload. `score: null` means unknown (legacy `"1"`). */
export type RevisionQuizCompletionPayload = {
  version: 1;
  completed: true;
  score: number | null;
  questionCount: number;
  completedAt: string;
  setSignature: string;
};

/**
 * Auth payloads use `id` (login); some profile paths also expose `_id`.
 * Prefer `_id` when both exist (same pattern as LessonViewPage elsewhere).
 */
export function resolveAuthUserId(
  user: { _id?: unknown; id?: unknown } | null | undefined
): string | undefined {
  const raw = user?._id ?? user?.id;
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

export function buildRevisionQuizCompletionKey(scope: RevisionQuizCompletionScope): string {
  const student = encodeURIComponent(String(scope.studentId || "").trim() || "anon");
  const lesson = encodeURIComponent(String(scope.lessonId || "").trim() || "none");
  const page = encodeURIComponent(String(scope.pageId || "").trim() || "END");
  const sig = encodeURIComponent(String(scope.setSignature || "").trim() || "empty");
  return `${STORAGE_PREFIX}${student}:${lesson}:${page}:${sig}`;
}

function parseStoredPayload(
  raw: string | null,
  scope: RevisionQuizCompletionScope,
  fallbackQuestionCount?: number
): RevisionQuizCompletionPayload | null {
  if (raw == null) return null;
  if (raw === "1") {
    return {
      version: 1,
      completed: true,
      score: null,
      questionCount:
        typeof fallbackQuestionCount === "number" && fallbackQuestionCount > 0
          ? fallbackQuestionCount
          : 0,
      completedAt: "",
      setSignature: scope.setSignature,
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RevisionQuizCompletionPayload>;
    if (!parsed || parsed.completed !== true) return null;
    const score =
      parsed.score == null
        ? null
        : Number.isFinite(Number(parsed.score))
          ? Math.max(0, Math.floor(Number(parsed.score)))
          : null;
    const questionCount = Number.isFinite(Number(parsed.questionCount))
      ? Math.max(0, Math.floor(Number(parsed.questionCount)))
      : typeof fallbackQuestionCount === "number"
        ? fallbackQuestionCount
        : 0;
    return {
      version: 1,
      completed: true,
      score,
      questionCount,
      completedAt: typeof parsed.completedAt === "string" ? parsed.completedAt : "",
      setSignature:
        typeof parsed.setSignature === "string" && parsed.setSignature
          ? parsed.setSignature
          : scope.setSignature,
    };
  } catch {
    return null;
  }
}

export function getRevisionQuizCompletion(
  scope: RevisionQuizCompletionScope,
  fallbackQuestionCount?: number
): RevisionQuizCompletionPayload | null {
  if (typeof localStorage === "undefined") return null;
  if (!scope.studentId || !scope.lessonId || !scope.setSignature) return null;
  try {
    return parseStoredPayload(
      localStorage.getItem(buildRevisionQuizCompletionKey(scope)),
      scope,
      fallbackQuestionCount
    );
  } catch {
    return null;
  }
}

export function getRevisionQuizCompleted(scope: RevisionQuizCompletionScope): boolean {
  return getRevisionQuizCompletion(scope) != null;
}

export function setRevisionQuizCompleted(
  scope: RevisionQuizCompletionScope,
  value: false | RevisionQuizCompletionPayload
): void {
  if (typeof localStorage === "undefined") return;
  if (!scope.studentId || !scope.lessonId || !scope.setSignature) return;
  try {
    const key = buildRevisionQuizCompletionKey(scope);
    if (value === false) {
      localStorage.removeItem(key);
      return;
    }
    const payload: RevisionQuizCompletionPayload = {
      version: 1,
      completed: true,
      score: value.score == null ? null : Math.max(0, Math.floor(Number(value.score))),
      questionCount: Math.max(0, Math.floor(Number(value.questionCount) || 0)),
      completedAt: value.completedAt || new Date().toISOString(),
      setSignature: value.setSignature || scope.setSignature,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function buildRevisionQuizCompletionPayload(params: {
  score: number;
  questionCount: number;
  setSignature: string;
  completedAt?: string;
}): RevisionQuizCompletionPayload {
  return {
    version: 1,
    completed: true,
    score: Math.max(0, Math.floor(Number(params.score) || 0)),
    questionCount: Math.max(0, Math.floor(Number(params.questionCount) || 0)),
    completedAt: params.completedAt || new Date().toISOString(),
    setSignature: params.setSignature,
  };
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
