/**
 * Revision Practice teacher overrides — persisted in lesson.quiz.questions[].
 * Uses stable block.id (and question.id for multi-question banks) for linkage.
 */

export const REVISION_PRACTICE_OVERRIDE_SOURCE_TYPE = "revisionPracticeOverride";

export const REVISION_PRACTICE_OVERRIDE_TAGS = ["revision-practice", "teacher-override"] as const;

/** Schema-supported persisted lesson quiz question fields used by overrides. */
export type PersistedLessonQuizQuestion = {
  id: string;
  type: "mcq" | "short" | "exam";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  purpose?: string;
  tags?: string[];
  difficulty?: number;
  marks?: number;
  markScheme?: string[];
  pageId?: string;
  sourceQuestionId?: string;
  sourceType?: string;
  source?: string;
  aiGenerated?: boolean;
};

function safeStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

export function isPositionalBankQuestionId(id: string): boolean {
  return /^q\d+$/i.test(id.trim());
}

/** Stable linkage key persisted on override.sourceQuestionId. */
export function buildSourceLinkageKey(blockId: string, questionId?: string): string {
  const bid = safeStr(blockId);
  if (!bid) return "";
  const qid = safeStr(questionId);
  return qid ? `${bid}:${qid}` : bid;
}

export function parseSourceLinkageKey(key: string): { blockId: string; questionId?: string } {
  const raw = safeStr(key);
  if (!raw) return { blockId: "" };
  const colon = raw.indexOf(":");
  if (colon <= 0) return { blockId: raw };
  return { blockId: raw.slice(0, colon), questionId: raw.slice(colon + 1) };
}

export function isRevisionPracticeOverride(raw: Record<string, unknown>): boolean {
  if (safeStr(raw.sourceType) === REVISION_PRACTICE_OVERRIDE_SOURCE_TYPE) return true;
  const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
  return tags.includes("teacher-override") && tags.includes("revision-practice");
}

export function findRevisionPracticeOverride(
  questions: PersistedLessonQuizQuestion[],
  linkageKey: string
): PersistedLessonQuizQuestion | undefined {
  const key = safeStr(linkageKey);
  if (!key) return undefined;
  return questions.find(
    (q) =>
      isRevisionPracticeOverride(q as Record<string, unknown>) &&
      safeStr(q.sourceQuestionId) === key
  );
}

export function generateOverrideQuizId(): string {
  return `rp_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

export type MaterializeOverrideInput = {
  linkageKey: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  existingOverrideId?: string;
};

/** Create or update a persisted Revision Practice override entry. */
export function upsertRevisionPracticeOverride(
  questions: PersistedLessonQuizQuestion[],
  input: MaterializeOverrideInput
): PersistedLessonQuizQuestion[] {
  const linkageKey = safeStr(input.linkageKey);
  if (!linkageKey) return questions;

  const opts = input.options.map((o) => safeStr(o)).filter(Boolean).slice(0, 6);
  const correctAnswer = safeStr(input.correctAnswer);
  const question = safeStr(input.question);
  if (!question || opts.length < 2 || !correctAnswer) return questions;

  const base: PersistedLessonQuizQuestion = {
    id: input.existingOverrideId || generateOverrideQuizId(),
    type: "mcq",
    question,
    options: opts,
    correctAnswer,
    explanation: input.explanation != null ? safeStr(input.explanation) || undefined : undefined,
    sourceType: REVISION_PRACTICE_OVERRIDE_SOURCE_TYPE,
    sourceQuestionId: linkageKey,
    tags: [...REVISION_PRACTICE_OVERRIDE_TAGS],
  };

  const idx = questions.findIndex(
    (q) =>
      isRevisionPracticeOverride(q as Record<string, unknown>) &&
      safeStr(q.sourceQuestionId) === linkageKey
  );
  if (idx >= 0) {
    const next = [...questions];
    next[idx] = { ...next[idx], ...base, id: next[idx].id || base.id };
    return next;
  }
  return [...questions, base];
}

/** Remove override by linkage key or by persisted override id. */
export function removeRevisionPracticeOverride(
  questions: PersistedLessonQuizQuestion[],
  opts: { linkageKey?: string; overrideId?: string }
): PersistedLessonQuizQuestion[] {
  const linkageKey = safeStr(opts.linkageKey);
  const overrideId = safeStr(opts.overrideId);
  return questions.filter((q) => {
    if (!isRevisionPracticeOverride(q as Record<string, unknown>)) return true;
    if (overrideId && q.id === overrideId) return false;
    if (linkageKey && safeStr(q.sourceQuestionId) === linkageKey) return false;
    return true;
  });
}

export function listRevisionPracticeOverrides(
  questions: PersistedLessonQuizQuestion[]
): PersistedLessonQuizQuestion[] {
  return questions.filter((q) => isRevisionPracticeOverride(q as Record<string, unknown>));
}
