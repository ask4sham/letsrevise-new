/**
 * PR-PRACTICE-LOOP-1 Frontend: Practice set generation (student-safe).
 * Fresh V1: excludeSeen, resume by practiceSetId, fresh-availability.
 */
import api from "../services/api";

export const CONTENT_TYPES = [
  "quiz_mcq",
  "quiz_short",
  "exam_question",
  "past_paper_question",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type PracticeMode = "standard" | "challenge";

export type PracticeSetItem = {
  contentType: ContentType;
  contentId: string;
  topicKey: string;
  prompt: string;
  choices?: string[];
  metadata?: {
    difficulty?: number | null;
    skill?: string | null;
    marks?: number | null;
    estimatedTimeSec?: number | null;
    challenge?: boolean;
    badge?: string | null;
  };
};

/** Shared Practice generation filters (no relationship context). */
export type PracticeGenerationFilters = {
  specKey: string;
  topicKeys: string[];
  limit?: number;
  include?: ContentType[];
  difficulty?: number[];
  skill?: string[];
  mode?: PracticeMode;
  /** Fresh V1: server excludes lesson-linked + recent set/attempt keys */
  excludeSeen?: boolean;
  idempotencyKey?: string;
  source?: string;
  /** Revision quiz session exclusions (server-validated). */
  sessionExclusions?: {
    contentKeys?: string[];
    stemTexts?: string[];
    fingerprints?: string[];
  };
};

/**
 * Discriminated relationship context for Practice generation.
 * Normal student UI uses `class` or `lesson` only — never `legacyTeacher`.
 */
export type PracticeGenerationContext =
  | { mode: "class"; membershipPublicId: string }
  | { mode: "lesson"; lessonId: string }
  | { mode: "legacyTeacher"; teacherId: string };

export type GeneratePracticeSetPayload = PracticeGenerationFilters & {
  /** Opaque active class membership — preferred dashboard path. */
  membershipPublicId?: string;
  /** Lesson-scoped fresh practice: server verifies access and resolves lesson owner. */
  lessonId?: string;
  /**
   * Legacy compatibility only. Do not send from the normal student Practice page.
   * Ignored when lessonId is set; rejected when sent with membershipPublicId.
   */
  teacherId?: string;
};

/**
 * Prior attempt state for resume / completion (no correct answers / explanations).
 * attempted=true with omitted isCorrect means answered but score unknown (legacy).
 */
export type PracticePriorOutcome = {
  contentType: string;
  contentId: string;
  attempted?: boolean;
  isCorrect?: boolean;
};

export type GeneratePracticeSetResponse = {
  practiceSetId: string | null;
  items: PracticeSetItem[];
  mode?: PracticeMode;
  requestedCount?: number;
  availableFreshCount?: number;
  selectedCount?: number;
  allQuestionsFresh?: boolean;
  reusedFromIdempotencyKey?: boolean;
  /** Present on GET /practice-sets/:id (resume). Content-owner teacher for attempt submit. */
  teacherId?: string | null;
  lessonId?: string | null;
  /** Owner resume: attempted (+ optional isCorrect) per previously attempted set item. */
  priorOutcomes?: PracticePriorOutcome[];
  attemptedCount?: number;
  resumeStartIndex?: number;
  allItemsAttempted?: boolean;
};

export type FreshAvailabilityResponse = {
  requestedCount: number;
  availableFreshCount: number;
  selectedCount: number;
  allQuestionsFresh: boolean;
  practiceSetId: null;
  lessonPracticeAttemptCount?: number;
  lessonPracticeAttemptedQuestionIds?: string[];
  /** Incomplete lesson-scoped PracticeSet (prefer over generate). */
  resumeAvailable?: boolean;
  resumePracticeSetId?: string | null;
  resumeItemCount?: number;
  resumeAttemptedCount?: number;
  resumeRemainingCount?: number;
  /** Index of first unanswered item in frozen set order. */
  resumeStartIndex?: number;
  lessonId?: string | null;
};

export async function generatePracticeSet(
  payload: GeneratePracticeSetPayload
): Promise<GeneratePracticeSetResponse> {
  const body: Record<string, unknown> = {
    specKey: payload.specKey,
    topicKeys: payload.topicKeys,
    limit: payload.limit ?? 10,
    include: payload.include ?? [...CONTENT_TYPES],
    difficulty: payload.difficulty,
    skill: payload.skill,
    mode: payload.mode ?? "standard",
    excludeSeen: payload.excludeSeen === true,
    lessonId: payload.lessonId,
    idempotencyKey: payload.idempotencyKey,
    source: payload.source,
    sessionExclusions: payload.sessionExclusions,
  };
  if (payload.membershipPublicId) {
    body.membershipPublicId = payload.membershipPublicId;
  } else if (payload.teacherId) {
    body.teacherId = payload.teacherId;
  }
  const res = await api.post<GeneratePracticeSetResponse>(
    "/practice-sets/generate",
    body
  );
  return res.data;
}

/** Map Practice relationship errors to student-safe copy. */
export function getPracticeGenerationErrorMessage(
  err: unknown,
  fallback = "Could not start Practice."
): string {
  const e = err as {
    status?: number;
    message?: string;
    data?: { error?: string; code?: string; msg?: string };
    response?: { status?: number; data?: { error?: string; code?: string; msg?: string } };
  };
  const status = e?.status ?? e?.response?.status;
  const code = e?.data?.code || e?.response?.data?.code;
  const apiMsg =
    e?.data?.error ||
    e?.data?.msg ||
    e?.response?.data?.error ||
    e?.response?.data?.msg ||
    e?.message;

  if (code === "CLASS_ARCHIVED") return "This class is no longer active.";
  if (code === "MEMBERSHIP_REMOVED") return "This class link is no longer active.";
  if (code === "MEMBERSHIP_NOT_FOUND" || status === 404) {
    return "This class link is no longer available.";
  }
  if (code === "AMBIGUOUS_PRACTICE_CONTEXT") {
    return "Choose either a class or a teacher link, not both.";
  }
  if (status === 403) {
    if (apiMsg && /lesson access/i.test(apiMsg)) return apiMsg;
    return "You do not have access to start Practice with this class.";
  }
  if (status === 401) return "Please log in again.";
  return apiMsg || fallback;
}

export async function getPracticeSet(
  practiceSetId: string
): Promise<GeneratePracticeSetResponse> {
  const res = await api.get<GeneratePracticeSetResponse>(
    `/practice-sets/${encodeURIComponent(practiceSetId)}`
  );
  return res.data;
}

export async function fetchFreshAvailability(params: {
  /** Required for non-lesson (dashboard) calls. Ignored when lessonId is set (server resolves owner). */
  teacherId?: string;
  specKey: string;
  topicKey: string;
  lessonId?: string;
  limit?: number;
  include?: ContentType[];
  sessionExclusions?: {
    contentKeys?: string[];
    stemTexts?: string[];
    fingerprints?: string[];
  };
}): Promise<FreshAvailabilityResponse> {
  const search = new URLSearchParams();
  search.set("specKey", params.specKey);
  search.set("topicKey", params.topicKey);
  if (params.lessonId) search.set("lessonId", params.lessonId);
  if (params.teacherId && !params.lessonId) search.set("teacherId", params.teacherId);
  search.set("limit", String(params.limit ?? 5));
  if (params.include?.length) search.set("include", params.include.join(","));
  if (params.sessionExclusions) {
    search.set("sessionExclusions", JSON.stringify(params.sessionExclusions));
  }
  const res = await api.get<FreshAvailabilityResponse>(
    `/practice-sets/fresh-availability?${search.toString()}`
  );
  return res.data;
}
