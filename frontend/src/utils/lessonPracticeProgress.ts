/**
 * Dedicated lesson practice pool progress (PracticeSection only — not checkpoints/pageQuiz).
 * questionId matches PracticeAttempt.questionId / PracticeQuestionLite.id (ExamQuestion ObjectId string).
 */

const STORAGE_PREFIX = "lesson-practice-answered:";

export function answeredStorageKey(lessonId: string): string {
  return `${STORAGE_PREFIX}${lessonId}`;
}

export function getLocalAnsweredPracticeIds(lessonId: string | null | undefined): Set<string> {
  if (!lessonId || typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(answeredStorageKey(lessonId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)).filter(Boolean));
  } catch {
    return new Set();
  }
}

export function markLocalPracticeAnswered(
  lessonId: string | null | undefined,
  questionId: string | null | undefined
): void {
  if (!lessonId || !questionId || typeof localStorage === "undefined") return;
  const set = getLocalAnsweredPracticeIds(lessonId);
  set.add(String(questionId));
  try {
    localStorage.setItem(answeredStorageKey(lessonId), JSON.stringify(Array.from(set)));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("lesson-practice-answered", {
          detail: { lessonId, questionId: String(questionId) },
        })
      );
    }
  } catch {
    // ignore quota / private mode
  }
}

export type DedicatedPracticeState = "not_started" | "in_progress" | "completed" | "empty";

/**
 * State from dedicated PracticeSection pool ids + answered question ids only.
 */
export function computeDedicatedPracticeState(
  poolQuestionIds: string[],
  answeredQuestionIds: Iterable<string>
): DedicatedPracticeState {
  const pool = Array.from(
    new Set((poolQuestionIds || []).map((id) => String(id)).filter(Boolean))
  );
  if (pool.length === 0) return "empty";
  const answered = new Set(Array.from(answeredQuestionIds as Iterable<string>).map((id) => String(id)));
  let hit = 0;
  for (let i = 0; i < pool.length; i++) {
    if (answered.has(pool[i])) hit += 1;
  }
  if (hit <= 0) return "not_started";
  if (hit >= pool.length) return "completed";
  return "in_progress";
}

/** Stable client idempotency key for one fresh-practice user action. */
export function createFreshPracticeIdempotencyKey(parts: {
  topicKey: string;
  lessonId?: string | null;
  clientRequestId: string;
}): string {
  const topic = encodeURIComponent(String(parts.topicKey || "").trim());
  const lesson = encodeURIComponent(String(parts.lessonId || "").trim() || "none");
  const req = String(parts.clientRequestId || "").trim().slice(0, 80);
  return `fresh-practice:${topic}:${lesson}:${req}`;
}

export function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
