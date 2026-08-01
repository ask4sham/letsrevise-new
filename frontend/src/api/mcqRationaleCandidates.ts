/**
 * V2.3B2a/B2b1/B2b2b — MCQ rationale candidate API client.
 * Create + reject + one dedicated replacement. No approve / save / ExamQuestion mutation methods.
 */
import api from "../services/api";
import type { McqRationaleSafeCandidate } from "./mcqRationaleReviewContext";
import type { RejectionReasonCode } from "./mcqRationaleRejectionReasons";

export type McqRationaleCandidate = McqRationaleSafeCandidate;
export type { RejectionReasonCode };

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const REPLACEMENT_IDEM_PREFIX = "mcq-rationale-replacement";

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

export type GenerateReplacementMcqRationaleCandidateRequest = {
  rejectedCandidateId: string;
  questionId: string;
  partLabel: string;
  expectedSourceFingerprint: string;
  idempotencyKey: string;
};

export type GenerateReplacementMcqRationaleCandidateResponse = {
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

/** Deterministic FNV-style hex digest (no personal data; stable across refresh). */
function stableHexDigest(material: string, hexChars = 32): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x811c9dc5 ^ 0x9e3779b9;
  let h4 = 0x01000193 ^ 0x85ebca6b;
  for (let i = 0; i < material.length; i++) {
    const c = material.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x811c9dc5);
    h3 = Math.imul(h3 ^ (c + i), 0x01000193);
    h4 = Math.imul(h4 ^ (c * (i + 1)), 0x85ebca6b);
  }
  const hex =
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h3 >>> 0).toString(16).padStart(8, "0") +
    (h4 >>> 0).toString(16).padStart(8, "0");
  return hex.slice(0, hexChars);
}

/**
 * Source-bound replacement idempotency key (deterministic; never random per click).
 * Shape: mcq-rationale-replacement:<candidateId>:<questionId>:<partLabel>:<fingerprint>
 * Hashed when length/charset would exceed backend IDEMPOTENCY_KEY_RE (max 128).
 */
export function createMcqRationaleReplacementIdempotencyKey(input: {
  rejectedCandidateId: string;
  questionId: string;
  partLabel: string;
  sourceFingerprint: string;
}): string {
  const candidateId = String(input.rejectedCandidateId || "").trim();
  const questionId = String(input.questionId || "").trim();
  const partLabel = String(input.partLabel || "").trim();
  const fingerprint = String(input.sourceFingerprint || "")
    .trim()
    .toLowerCase();
  const raw = `${REPLACEMENT_IDEM_PREFIX}:${candidateId}:${questionId}:${partLabel}:${fingerprint}`;
  if (raw.length <= 128 && IDEMPOTENCY_KEY_RE.test(raw)) {
    return raw;
  }
  const digest = stableHexDigest(raw, 32);
  const hashed = `${REPLACEMENT_IDEM_PREFIX}:${digest}`;
  if (!IDEMPOTENCY_KEY_RE.test(hashed)) {
    return `mcqrep_${digest}`.slice(0, 128);
  }
  return hashed;
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

/**
 * Dedicated Attempt-2 replacement endpoint. Never use the generic create route for replacement.
 */
export async function generateReplacementMcqRationaleCandidate(
  body: GenerateReplacementMcqRationaleCandidateRequest
): Promise<GenerateReplacementMcqRationaleCandidateResponse> {
  const payload = {
    questionId: body.questionId,
    partLabel: body.partLabel,
    expectedSourceFingerprint: body.expectedSourceFingerprint,
    idempotencyKey: body.idempotencyKey,
  };
  const res = await api.post<GenerateReplacementMcqRationaleCandidateResponse>(
    `/admin/exam-question-rationale-candidates/${encodeURIComponent(body.rejectedCandidateId)}/replacement`,
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
