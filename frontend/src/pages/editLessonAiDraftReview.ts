/**
 * Teacher Editor AI draft review-link gating.
 * Live bank counts are preferred; session generate counts are a same-mount fallback.
 * Persistent identity must match the namespaced topicKey generation writes.
 */

export type AiDraftAssetCounts = {
  flashcards: number;
  quizQuestions: number;
  examQuestions: number;
};

export type AiLessonDraftReviewLessonIdentity = {
  /** In-memory topicKey — may already be a frontend alias (e.g. respiration). */
  topicKey?: string | null;
  /** Unmutated topicKey from the lesson GET, before topicNorm.namespaced. */
  persistedTopicKey?: string | null;
  specKey?: string | null;
  canonicalTopicKey?: string | null;
};

function trimOrEmpty(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** First-colon parse — same shape as backend parseTopicKey (slug may contain '/'). */
export function parseTopicKeyForBankReview(topicKey: string): {
  specKey: string;
  topicKeySlug: string;
  isNamespaced: boolean;
} {
  const trimmed = topicKey.trim();
  const idx = trimmed.indexOf(":");
  if (idx === -1) {
    return { specKey: "", topicKeySlug: trimmed, isNamespaced: false };
  }
  return {
    specKey: trimmed.slice(0, idx),
    topicKeySlug: trimmed.slice(idx + 1) || trimmed,
    isNamespaced: true,
  };
}

function asNamespacedTopicKey(raw: string | null | undefined, specHint?: string | null): string | null {
  const trimmed = trimOrEmpty(raw);
  if (!trimmed) return null;
  const parsed = parseTopicKeyForBankReview(trimmed);
  if (parsed.isNamespaced && parsed.specKey && parsed.topicKeySlug) {
    return `${parsed.specKey}:${parsed.topicKeySlug}`;
  }
  const spec = trimOrEmpty(specHint);
  if (spec && parsed.topicKeySlug) return `${spec}:${parsed.topicKeySlug}`;
  return null;
}

/**
 * AI-draft review identity (not general lesson topic mapping).
 * 1. unmutated persisted GET topicKey (generation writes this)
 * 2. specKey + canonicalTopicKey
 * 3. live topicKeyForBank
 * 4. same-mount generate key
 * In-memory lesson.topicKey is last among lesson fields so a post-norm alias
 * (e.g. respiration) cannot override a persisted long Edexcel slug.
 * Does not use browser/localStorage spec defaults.
 */
export function persistentAiLessonDraftReviewTopicKey(args: {
  topicKeyForBank?: string | null;
  sessionGenerateTopicKey?: string | null;
  persistedTopicKey?: string | null;
  lessonTopicKey?: string | null;
  lessonSpecKey?: string | null;
  lessonCanonicalTopicKey?: string | null;
}): string | null {
  const spec = trimOrEmpty(args.lessonSpecKey);
  const fromPersisted = asNamespacedTopicKey(args.persistedTopicKey, spec);
  if (fromPersisted) return fromPersisted;
  const fromCanonical = asNamespacedTopicKey(args.lessonCanonicalTopicKey, spec);
  if (fromCanonical) return fromCanonical;
  const fromLive = asNamespacedTopicKey(args.topicKeyForBank, spec);
  if (fromLive) return fromLive;
  const fromSession = asNamespacedTopicKey(args.sessionGenerateTopicKey, spec);
  if (fromSession) return fromSession;
  return asNamespacedTopicKey(args.lessonTopicKey, spec);
}

export function resolveAiLessonDraftReviewTopicKey(
  topicKeyForBank: string | null | undefined,
  sessionGenerateTopicKey: string | null | undefined,
  lesson?: AiLessonDraftReviewLessonIdentity | null
): string | null {
  return persistentAiLessonDraftReviewTopicKey({
    topicKeyForBank,
    sessionGenerateTopicKey,
    persistedTopicKey: lesson?.persistedTopicKey,
    lessonTopicKey: lesson?.topicKey,
    lessonSpecKey: lesson?.specKey,
    lessonCanonicalTopicKey: lesson?.canonicalTopicKey,
  });
}

/**
 * Spec + slug for bank list/URL queryCandidates([spec:slug, slug]).
 * When the review key is namespaced, that prefix is the spec — lesson spec cannot override it.
 * Unprefixed keys may use lesson.specKey. Browser spec defaults must not override a namespaced prefix.
 */
export function splitTopicKeyForBankReview(
  topicKey: string,
  lessonSpecKey?: string | null
): { specKey: string; topicKeySlug: string } {
  const parsed = parseTopicKeyForBankReview(topicKey);
  if (parsed.isNamespaced && parsed.specKey) {
    return { specKey: parsed.specKey, topicKeySlug: parsed.topicKeySlug };
  }
  const fromLesson = trimOrEmpty(lessonSpecKey);
  return {
    specKey: fromLesson || parsed.topicKeySlug,
    topicKeySlug: parsed.topicKeySlug,
  };
}

export function shouldShowAiLessonDraftReviewLink(
  liveCount: number,
  sessionGeneratedCount?: number | null
): boolean {
  return liveCount > 0 || (sessionGeneratedCount ?? 0) > 0;
}

export function hasAiLessonDraftReviewToolbar(args: {
  topicKey: string | null | undefined;
  lessonId: string | null | undefined;
  isMongoObjectId: (id: string) => boolean;
  pendingDrafts: AiDraftAssetCounts;
  lastGenerated: AiDraftAssetCounts | null;
}): boolean {
  const topicKey = typeof args.topicKey === "string" ? args.topicKey.trim() : "";
  if (!topicKey || !args.lessonId || !args.isMongoObjectId(args.lessonId)) return false;
  const live = args.pendingDrafts;
  if (live.flashcards > 0 || live.quizQuestions > 0 || live.examQuestions > 0) return true;
  const generated = args.lastGenerated;
  if (!generated) return false;
  return generated.flashcards > 0 || generated.quizQuestions > 0 || generated.examQuestions > 0;
}

export function countFromSettledList(result: PromiseSettledResult<unknown[]>): number {
  if (result.status !== "fulfilled") return 0;
  return Array.isArray(result.value) ? result.value.length : 0;
}

export function pendingDraftsFromSettledLists(args: {
  flashcards: PromiseSettledResult<unknown[]>;
  quiz: PromiseSettledResult<unknown[]>;
  exam: PromiseSettledResult<unknown[]>;
}): AiDraftAssetCounts {
  return {
    flashcards: countFromSettledList(args.flashcards),
    quizQuestions: countFromSettledList(args.quiz),
    examQuestions: countFromSettledList(args.exam),
  };
}
