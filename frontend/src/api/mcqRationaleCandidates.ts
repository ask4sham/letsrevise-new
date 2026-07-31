/**
 * V2.3B2a — single-record MCQ rationale candidate generation API client.
 * Create only. No reject / approve / regenerate / save / ExamQuestion mutation methods.
 */
import api from "../services/api";
import type { McqRationaleSafeCandidate } from "./mcqRationaleReviewContext";

export type McqRationaleCandidate = McqRationaleSafeCandidate;

export type CreateMcqRationaleCandidateRequest = {
  questionId: string;
  partLabel: string;
  idempotencyKey: string;
  expectedSourceFingerprint?: string;
};

export type CreateMcqRationaleCandidateResponse = {
  candidate: McqRationaleCandidate;
  replayed: boolean;
};

export type McqRationaleCandidateApiError = {
  status?: number;
  code: string;
  message: string;
  candidate: McqRationaleCandidate | null;
  networkUncertain: boolean;
};

/** Browser-safe key matching backend IDEMPOTENCY_KEY_RE (8–128 [A-Za-z0-9._:-]). */
export function createMcqRationaleCandidateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cand_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createMcqRationaleCandidate(
  body: CreateMcqRationaleCandidateRequest
): Promise<CreateMcqRationaleCandidateResponse> {
  const res = await api.post<CreateMcqRationaleCandidateResponse>(
    "/admin/exam-question-rationale-candidates",
    body
  );
  return res.data;
}

export function readMcqRationaleCandidateError(err: unknown): McqRationaleCandidateApiError {
  const ax = err as {
    message?: string;
    code?: string;
    response?: {
      status?: number;
      data?: {
        error?: string;
        code?: string;
        candidate?: McqRationaleCandidate | null;
      };
    };
  };

  const status = ax.response?.status;
  const hasResponse = ax.response != null;
  const networkUncertain =
    !hasResponse ||
    ax.code === "ERR_NETWORK" ||
    ax.code === "ECONNABORTED" ||
    /network error/i.test(String(ax.message || ""));

  const code =
    (ax.response?.data?.code && String(ax.response.data.code)) ||
    (networkUncertain ? "NETWORK_UNCERTAIN" : status === 401 || status === 403 ? "ACCESS_DENIED" : "SERVER_ERROR");

  const candidate =
    ax.response?.data?.candidate && typeof ax.response.data.candidate === "object"
      ? ax.response.data.candidate
      : null;

  return {
    status,
    code,
    message: String(ax.response?.data?.error || ax.message || "Candidate generation failed"),
    candidate,
    networkUncertain,
  };
}
