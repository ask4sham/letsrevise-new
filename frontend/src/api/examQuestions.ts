/**
 * PR-PAST-PAPERS-UI-3: Exam question bank — list mine, attach from bank.
 */

import api from "../services/api";
import { getErrorMessageFromData } from "../utils/apiErrorMessage";

export type ExamQuestionPart = {
  label: string;
  type: "mcq" | "short" | "table" | string;
  marks: number;
  questionText: string;
  options?: string[];
  correctIndex?: number | null;
  markScheme?: string[];
  /** V2 interaction payload (e.g. table headers/rows). Absent on V1 parts. */
  partData?: Record<string, unknown>;
};

export type ExamQuestion = {
  _id: string;
  specKey?: string;
  topicKey?: string;
  topic?: string;
  subject?: string;
  examBoard?: string;
  level?: string;
  question: string;
  marks?: number | null;
  markScheme?: string[];
  type?: string;
  options?: string[];
  correctIndex?: number | null;
  correctAnswer?: string | null;
  imageUrl?: string | null;
  status?: "draft" | "published" | string;
  difficulty?: number | null;
  skill?: string | null;
  estimatedTimeSec?: number | null;
  metadata?: Record<string, unknown>;
  /** Composite Exam Question V1 */
  questionMode?: "single" | "composite" | string;
  title?: string | null;
  sharedStem?: string | null;
  totalMarks?: number | null;
  parts?: ExamQuestionPart[];
  /** Composite Exam Engine V2; omitted on legacy records (= schema V1). */
  schemaVersion?: 1 | 2;
};

export type ExamQuestionFilters = {
  difficulty?: number;
  difficultyMin?: number;
  difficultyMax?: number;
  skill?: string;
  estimatedTimeMaxSec?: number;
};

export async function fetchMyExamQuestions(params: {
  token: string;
  specKey: string;
  topicKey?: string;
  q?: string;
  limit?: number;
  difficulty?: number;
  difficultyMin?: number;
  difficultyMax?: number;
  skill?: string;
  estimatedTimeMaxSec?: number;
}): Promise<{ items: ExamQuestion[] }> {
  const url = new URL("/api/exam-questions/mine", window.location.origin);
  url.searchParams.set("specKey", params.specKey);
  if (params.topicKey) url.searchParams.set("topicKey", params.topicKey);
  if (params.q) url.searchParams.set("q", params.q);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.difficulty != null) url.searchParams.set("difficulty", String(params.difficulty));
  if (params.difficultyMin != null) url.searchParams.set("difficultyMin", String(params.difficultyMin));
  if (params.difficultyMax != null) url.searchParams.set("difficultyMax", String(params.difficultyMax));
  if (params.skill) url.searchParams.set("skill", params.skill);
  if (params.estimatedTimeMaxSec != null) url.searchParams.set("estimatedTimeMaxSec", String(params.estimatedTimeMaxSec));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load exam questions");
  return data as { items: ExamQuestion[] };
}

export type ExamQuestionListFilters = {
  subject?: string;
  examBoard?: string;
  level?: string;
  topic?: string;
  topicKey?: string;
  specKey?: string;
  type?: string;
  status?: string;
  mineOnly?: boolean;
  q?: string;
  limit?: number;
  page?: number;
};

export async function fetchExamQuestionsList(
  filters: ExamQuestionListFilters = {}
): Promise<{ questions: ExamQuestion[] }> {
  const params: Record<string, string> = {};
  if (filters.subject) params.subject = filters.subject;
  if (filters.examBoard) params.examBoard = filters.examBoard;
  if (filters.level) params.level = filters.level;
  if (filters.topic) params.topic = filters.topic;
  if (filters.topicKey) params.topicKey = filters.topicKey;
  if (filters.specKey) params.specKey = filters.specKey;
  if (filters.type) params.type = filters.type;
  if (filters.status) params.status = filters.status;
  if (filters.mineOnly) params.mineOnly = "1";
  if (filters.limit != null) params.limit = String(filters.limit);
  if (filters.page != null) params.page = String(filters.page);

  const res = await api.get<{ success?: boolean; questions?: ExamQuestion[] }>("/exam-questions", { params });
  const questions = Array.isArray(res.data?.questions) ? res.data.questions : [];
  let list = questions;
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    list = list.filter((row) => String(row.question ?? "").toLowerCase().includes(q));
  }
  return { questions: list };
}

export async function fetchExamQuestionById(
  id: string,
  opts?: { lessonId?: string; classroomMode?: boolean }
): Promise<ExamQuestion | null> {
  const params: Record<string, string> = {};
  if (opts?.lessonId) params.lessonId = opts.lessonId;
  if (opts?.classroomMode) params.present = "classroom";
  const res = await api.get<{ success?: boolean; question?: ExamQuestion }>(`/exam-questions/${id}`, { params });
  return res.data?.question ?? null;
}

export async function fetchExamQuestionsByIds(
  ids: string[],
  opts?: { lessonId?: string; classroomMode?: boolean }
): Promise<ExamQuestion[]> {
  if (!ids.length) return [];
  const body: { ids: string[]; lessonId?: string } = { ids };
  if (opts?.lessonId) body.lessonId = opts.lessonId;
  const params = opts?.classroomMode ? { present: "classroom" } : undefined;
  const res = await api.post<{ success?: boolean; questions?: ExamQuestion[] }>(
    "/exam-questions/by-ids",
    body,
    { params }
  );
  return Array.isArray(res.data?.questions) ? res.data.questions : [];
}

export async function attachFromBank(params: {
  token: string;
  pastPaperId: string;
  examQuestionIds: string[];
  overrides?: Array<{ examQuestionId: string; questionNumber?: string; marks?: number }>;
}): Promise<{
  total: number;
  inserted: number;
  skippedDuplicates: number;
  invalid: number;
  errors: Array<{ examQuestionId: string; code: string; message?: string }>;
  preview: Array<{ examQuestionId: string; action: string }>;
}> {
  const res = await fetch("/api/past-paper-questions/attach-from-bank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pastPaperId: params.pastPaperId,
      examQuestionIds: params.examQuestionIds,
      overrides: params.overrides || [],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(getErrorMessageFromData(data, "Attach failed"));
  return data;
}

/** Publish a draft exam question (same gate as full PUT). */
export async function publishExamQuestion(id: string): Promise<Record<string, unknown>> {
  const res = await api.put<{ success: boolean; question: Record<string, unknown>; msg?: string; issues?: string[] }>(
    `/exam-questions/${id}`,
    { status: "published" }
  );
  if (!res.data?.success || !res.data.question) {
    throw new Error(res.data?.msg || "Publish failed");
  }
  return res.data.question as Record<string, unknown>;
}

/** Draft mcq/short only: LLM rewrite (validate + save). */
export async function aiRewriteExamQuestion(id: string, action: string): Promise<ExamQuestion & Record<string, unknown>> {
  const res = await api.post<{ success: boolean; question: ExamQuestion & Record<string, unknown>; msg?: string }>(
    `/exam-questions/${id}/ai-rewrite`,
    { action }
  );
  if (!res.data?.success || !res.data.question) {
    throw new Error(res.data?.msg || "Rewrite failed");
  }
  return res.data.question;
}

export type CompositeAiDraftDifficulty = "easy" | "medium" | "hard";

export type CompositeAiDraftPart = {
  label: string;
  type: string;
  marks: number;
  questionText: string;
  markSchemeLines: string[];
  options?: string[];
  correctIndex?: number | null;
  commandWord?: string;
  skill?: string;
};

export type CompositeAiDraft = {
  title: string;
  sharedStem: string;
  difficulty: string;
  totalMarks: number;
  parts: CompositeAiDraftPart[];
  warnings?: string[];
};

export type GenerateCompositeQuestionDraftPayload = {
  subject: string;
  examBoard: string;
  level: string;
  topic: string;
  topicKey: string;
  difficulty: CompositeAiDraftDifficulty;
  title?: string;
  hasImage?: boolean;
};

/**
 * POST /exam-questions/ai-draft-composite — returns draft JSON only (no DB write).
 */
export async function generateCompositeQuestionDraft(
  payload: GenerateCompositeQuestionDraftPayload
): Promise<CompositeAiDraft> {
  const friendlyFromCode = (code?: string, status?: number, msg?: string): string | null => {
    if (status === 429 || code === "ERR_ERL_UNEXPECTED_X_FORWARDED_FOR") {
      return "Too many AI draft requests. Try again in a minute.";
    }
    if (code === "LLM_NOT_CONFIGURED") return "AI service is not configured on the server.";
    if (code === "LLM_EMPTY" || code === "LLM_BAD_JSON") {
      return "AI service returned an unusable response. Please try again.";
    }
    if (code === "TOPIC_REQUIRED") return "Select a topic before generating.";
    if (code === "INVALID_DIFFICULTY") return "Choose Easy, Medium, or Hard.";
    if (code === "AI_DRAFT_INVALID" || status === 422) {
      return msg && msg.trim() ? msg : "AI draft failed validation. Try again.";
    }
    if (status === 404) {
      return "AI draft endpoint is not available on this server. Restart the local backend on the feature branch, or wait for deploy.";
    }
    if (status === 503) return msg && msg.trim() ? msg : "AI service is temporarily unavailable. Please try again.";
    return null;
  };

  const formatIssues = (issues?: string[]): string => {
    if (!Array.isArray(issues) || !issues.length) return "";
    return ` (${issues.slice(0, 3).join(", ")})`;
  };

  try {
    const res = await api.post<{
      success?: boolean;
      draft?: CompositeAiDraft;
      msg?: string;
      error?: string;
      issues?: string[];
      code?: string;
    }>("/exam-questions/ai-draft-composite", payload);
    if (!res.data?.success || !res.data.draft) {
      const friendly =
        friendlyFromCode(res.data?.code, undefined, res.data?.msg) ||
        res.data?.msg ||
        res.data?.error ||
        "Failed to generate composite draft";
      throw new Error(friendly + formatIssues(res.data?.issues));
    }
    return res.data.draft;
  } catch (err: unknown) {
    // Shared api client rejects with { message, status, data } (not AxiosError.response).
    if (err && typeof err === "object") {
      const e = err as {
        message?: string;
        status?: number;
        data?: { msg?: string; error?: string; message?: string; issues?: string[]; code?: string };
        response?: { status?: number; data?: { msg?: string; error?: string; message?: string; issues?: string[]; code?: string } };
      };
      const status = typeof e.status === "number" ? e.status : e.response?.status;
      const data = e.data || e.response?.data;
      const code = data?.code;
      const rawMsg =
        (typeof data?.msg === "string" && data.msg) ||
        (typeof data?.error === "string" && data.error) ||
        (typeof data?.message === "string" && data.message) ||
        (typeof e.message === "string" && e.message) ||
        "";
      const friendly = friendlyFromCode(code, status, rawMsg);
      if (friendly) throw new Error(friendly + formatIssues(data?.issues));
      if (rawMsg.trim() && rawMsg !== "Failed to generate composite draft") {
        throw new Error(rawMsg.trim() + formatIssues(data?.issues));
      }
    }
    if (err instanceof Error && err.message.trim()) throw err;
    throw new Error("Failed to generate composite draft");
  }
}
