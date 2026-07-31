/**
 * V2.3B2a/B2b1 — MCQ rationale candidate API client.
 * Create + reject only. No approve / regenerate / save / ExamQuestion mutation methods.
 */
import api from "../services/api";
import type { McqRationaleSafeCandidate } from "./mcqRationaleReviewContext";
import type { RejectionReasonCode } from "./mcqRationaleRejectionReasons";

export type McqRationaleCandidate = McqRationaleSafeCandidate;
export type { RejectionReasonCode };

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

export type RejectMcqRationaleCandidateRequest = {
  candidateId: string;
  questionId: string;
  partLabel: string;
  expectedSourceFingerprint: string;
  reasonCode: RejectionReasonCode;
  note?: string;
};

export type RejectMcqRationaleCandidateResponse = {
  candidate: McqRationaleSafeCandidate;
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

export async function rejectMcqRationaleCandidate(
  body: RejectMcqRationaleCandidateRequest
): Promise<RejectMcqRationaleCandidateResponse> {
  const { candidateId, ...rest } = body;
  const payload: {
    questionId: string;
    partLabel: string;
    expectedSourceFingerprint: string;
    reasonCode: RejectionReasonCode;
    note?: string;
  } = {
    questionId: rest.questionId,
    partLabel: rest.partLabel,
    expectedSourceFingerprint: rest.expectedSourceFingerprint,
    reasonCode: rest.reasonCode,
  };
  if (rest.note != null && rest.note.trim() !== "") {
    payload.note = rest.note.trim();
  }
  const res = await api.post<RejectMcqRationaleCandidateResponse>(
    `/admin/exam-question-rationale-candidates/${encodeURIComponent(candidateId)}/reject`,
    payload
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
    message: String(ax.response?.data?.error || ax.message || "Candidate request failed"),
    candidate,
    networkUncertain,
  };
}
