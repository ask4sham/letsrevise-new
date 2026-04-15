// frontend/src/api/lessons.ts
import type { ApiError } from "../utils/apiError";
import { parseApiError } from "../utils/apiError";
import api from "../services/api";

const RAW_API_BASE = (
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE ||
  ""
).trim();
function normalizeApiHost(raw: string) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
}
const API_HOST = RAW_API_BASE ? normalizeApiHost(RAW_API_BASE) : "";
const API_BASE = API_HOST ? `${API_HOST}/api` : "";

export type LessonResponse =
  | { ok: true; data: any; accessDecision?: any }
  | { ok: false; apiError: ApiError };

/**
 * Fetch lesson by id. Returns normalized result for 401/402/403/404 handling.
 * Uses same auth token as api (localStorage) and same base URL.
 * Uses raw fetch (not api.get) so 401 does not trigger global redirect — we show "Please sign in" in-page.
 */
export async function fetchLessonById(lessonId: string): Promise<LessonResponse> {
  const url = API_BASE ? `${API_BASE}/lessons/${lessonId}` : `/api/lessons/${lessonId}`;
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    return { ok: false, apiError: await parseApiError(res) };
  }

  const json = await res.json();
  return {
    ok: true,
    data: json,
    accessDecision: json?.accessDecision,
  };
}

/** PR-EDGE-1: Auto-generate flashcards + quiz + assessment + past papers from topic banks (replace semantics). */
export type AutoGenerateResult = {
  ok: boolean;
  lessonId: string;
  topicKey: string;
  results: { flashcardsAdded: number; quizAdded: number; assessmentAdded: number; pastPapersAdded: number };
  lesson: any;
};

export async function autoGenerateFromBanks(
  lessonId: string,
  topicKey?: string | null
): Promise<AutoGenerateResult> {
  const res = await api.post<AutoGenerateResult>(`/lessons/${lessonId}/auto-generate`, {
    topicKey: topicKey ?? undefined,
  });
  return res.data!;
}

/** Reuse suggestions: lessons matching topicKey (max 10). includeDrafts defaults true for teachers. */
export type LessonByTopicKeyItem = {
  _id: string;
  title: string;
  subject: string;
  level: string;
  examBoard: string;
  topicKey: string;
  updatedAt: string;
  ownerName?: string;
  teacherId?: string;
  isPublished: boolean;
  status: string;
};

export async function getLessonsByTopicKey(
  topicKey: string,
  options?: { includeDrafts?: boolean }
): Promise<{ lessons: LessonByTopicKeyItem[] }> {
  const params = new URLSearchParams({ topicKey });
  if (options?.includeDrafts === false) params.set("includeDrafts", "false");
  const res = await api.get<{ lessons: LessonByTopicKeyItem[] }>(`/lessons/by-topicKey?${params.toString()}`);
  return res.data!;
}

/** Duplicate a lesson as a new draft owned by the current teacher. */
export async function duplicateLesson(lessonId: string): Promise<{ lessonId: string }> {
  const res = await api.post<{ lessonId: string }>(`/lessons/${lessonId}/duplicate`, {});
  return res.data!;
}

/** Improve an existing lesson with AI (creates new draft, original unchanged). */
export async function improveLessonWithAI(
  lessonId: string,
  options?: { additionalInstructions?: string; strictSpec?: boolean }
): Promise<{ success: boolean; lessonId: string }> {
  const res = await api.post<{ success: boolean; lessonId: string }>("/ai/improve-lesson", {
    lessonId,
    additionalInstructions: options?.additionalInstructions,
    strictSpec: options?.strictSpec,
  });
  return res.data!;
}

/** Auto-attach content (fill-only when empty): flashcards + quiz (+ optional assessments) from topic banks. */
export type AutoAttachAttached = {
  flashcards: { count: number; source: string };
  quiz: { mcqCount: number; shortCount: number; source: string };
  assessments?: { count: number };
};

export type AutoAttachContentResult = {
  ok: boolean;
  lessonId: string;
  topicKey: string;
  attached: AutoAttachAttached;
  lesson: any;
};

export async function autoAttachLessonContent(
  lessonId: string,
  options?: { includeAssessments?: boolean }
): Promise<AutoAttachContentResult> {
  const res = await api.post<AutoAttachContentResult>(`/lessons/${lessonId}/auto-attach-content`, {
    includeAssessments: options?.includeAssessments ?? false,
  });
  return res.data!;
}

/** Detach only auto-attached content (items with tag "auto-attached"); manual content kept. */
export type DetachAutoAttachedResult = {
  ok: boolean;
  detached: { flashcards: number; quiz: number };
  lesson: any;
};

export async function detachAutoAttachedContent(lessonId: string): Promise<DetachAutoAttachedResult> {
  const res = await api.post<DetachAutoAttachedResult>(`/lessons/${lessonId}/detach-auto-attached-content`, {});
  return res.data!;
}

/**
 * Draft-only curriculum AI review (server: CURRICULUM_AI_REVIEW_ENABLED).
 * Suggestions are stored on the lesson; teacher content is never overwritten by this feature.
 */
export type CurriculumAiReviewResultPayload = {
  status: string;
  curriculumMatchScore: number;
  lessonQualityScore: number;
  issues: string[];
  warnings: string[];
  missingCoverage: string[];
  terminologyFixes: Array<{ from: string; to: string; note: string }>;
  suggestedRewrites: Array<{
    section: string;
    originalSnippet: string;
    suggestion: string;
    note: string;
  }>;
  suggestedObjectives: string[];
  suggestedPriorKnowledge: string[];
  suggestedKeywords: string[];
  examAlignmentNotes: string[];
  checkpointAlignmentNotes: string[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type CurriculumAiReviewDoc = {
  status?: "idle" | "queued" | "running" | "completed" | "failed";
  trigger?: "manual" | "draft_save";
  lastError?: string | null;
  generatedAt?: string | null;
  startedAt?: string | null;
  result?: CurriculumAiReviewResultPayload | null;
  model?: string;
  provider?: string;
  promptVersion?: string;
};

export async function getCurriculumAiReview(lessonId: string): Promise<{
  curriculumAiReview: CurriculumAiReviewDoc | null;
}> {
  const res = await api.get<{ curriculumAiReview: CurriculumAiReviewDoc | null }>(
    `/lessons/${lessonId}/curriculum-ai-review`
  );
  return res.data!;
}

export async function requestCurriculumAiReview(lessonId: string): Promise<{
  ok: boolean;
  curriculumAiReview: CurriculumAiReviewDoc;
  lesson: unknown;
}> {
  const res = await api.post<{
    ok: boolean;
    curriculumAiReview: CurriculumAiReviewDoc;
    lesson: unknown;
  }>(`/lessons/${lessonId}/curriculum-ai-review`, {});
  return res.data!;
}
