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

export type GeneratePracticeSetPayload = {
  teacherId: string;
  specKey: string;
  topicKeys: string[];
  limit?: number;
  include?: ContentType[];
  difficulty?: number[];
  skill?: string[];
  mode?: PracticeMode;
  /** Fresh V1: server excludes lesson-linked + recent set/attempt keys */
  excludeSeen?: boolean;
  lessonId?: string;
  idempotencyKey?: string;
  source?: string;
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
};

export type FreshAvailabilityResponse = {
  requestedCount: number;
  availableFreshCount: number;
  selectedCount: number;
  allQuestionsFresh: boolean;
  practiceSetId: null;
  lessonPracticeAttemptCount?: number;
  lessonPracticeAttemptedQuestionIds?: string[];
};

export async function generatePracticeSet(
  payload: GeneratePracticeSetPayload
): Promise<GeneratePracticeSetResponse> {
  const body = {
    teacherId: payload.teacherId,
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
  };
  const res = await api.post<GeneratePracticeSetResponse>(
    "/practice-sets/generate",
    body
  );
  return res.data;
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
  teacherId: string;
  specKey: string;
  topicKey: string;
  lessonId?: string;
  limit?: number;
  include?: ContentType[];
}): Promise<FreshAvailabilityResponse> {
  const search = new URLSearchParams();
  search.set("teacherId", params.teacherId);
  search.set("specKey", params.specKey);
  search.set("topicKey", params.topicKey);
  if (params.lessonId) search.set("lessonId", params.lessonId);
  search.set("limit", String(params.limit ?? 5));
  if (params.include?.length) search.set("include", params.include.join(","));
  const res = await api.get<FreshAvailabilityResponse>(
    `/practice-sets/fresh-availability?${search.toString()}`
  );
  return res.data;
}
