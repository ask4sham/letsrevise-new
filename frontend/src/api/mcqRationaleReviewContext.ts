/**
 * V2.3B1/B2 MCQ rationale review-context API client (GET only).
 * Candidate create/reject live in mcqRationaleCandidates.ts.
 * No approve / regenerate / save / ExamQuestion mutation methods here.
 */
import api from "../services/api";

export type RationaleBucket = "missing" | "empty" | "generic" | "substantive" | "malformed";

export type McqRationaleReviewOption = {
  index: number;
  text: string;
  isCorrect: boolean;
};

export type McqRationaleReviewTaxonomy = {
  subject: string;
  examBoard: string;
  level: string;
  tier: string;
  topic: string;
  topicKey: string;
};

export type McqRationaleSafeCandidate = {
  candidateId: string;
  questionId: string;
  partLabel: string;
  status: string;
  attemptNumber: number;
  sourceFingerprint: string;
  sourceUpdatedAt: string | null;
  sourceSnapshot: Record<string, unknown>;
  explanation: string;
  promptVersion: string;
  model: string;
  generatedAt: string | null;
  completedAt: string | null;
  validationIssueCodes: string[];
  failureCode: string;
  /** Present after rejection (ISO string). */
  rejectedAt?: string | null;
  /** Bounded reason code after rejection. */
  rejectionReasonCode?: string | null;
};

/** Bounded media diagnostic — no URLs, mediaIds, filenames, or tokens. */
export type McqRationaleMediaContext = {
  referencePresent: boolean;
  scope: "question_shared" | "none";
  trustedContextAvailable: boolean;
};

export type McqRationaleReviewContext = {
  questionId: string;
  partLabel: string;
  taxonomy: McqRationaleReviewTaxonomy;
  questionStatus: string;
  sharedStem: string;
  questionText: string;
  options: McqRationaleReviewOption[];
  correctIndex: number | null;
  correctOption: string | null;
  marks: number | null;
  markScheme: string[];
  currentRationale: string | null;
  rationaleBucket: RationaleBucket;
  potentiallyEligibleForBackfill: boolean;
  currentSourceFingerprint: string;
  sourceUpdatedAt: string | null;
  imageContextAvailable: boolean;
  imageContextRequired: boolean;
  imageContextText?: string;
  /** Optional for backward compatibility with older backends. */
  mediaContext?: McqRationaleMediaContext;
  generationFeatureEnabled: boolean;
  publishedGenerationEnabled: boolean;
  canGenerate: boolean;
  canGenerateReason: string;
  /** V2.3B2b1 — reject endpoint / canReject gated by FEATURE_MCQ_RATIONALE_CANDIDATE_REJECT_V23B2B. */
  rejectionFeatureEnabled?: boolean;
  canReject?: boolean;
  rejectDisabledReason?: string | null;
  latestCandidate: McqRationaleSafeCandidate | null;
  candidateIsStale: boolean;
  readOnly: true;
};

export type McqRationaleReviewContextError = {
  error?: string;
  code?: string;
  structureReason?: string;
  bucket?: string;
};

export async function fetchMcqRationaleReviewContext(
  questionId: string,
  partLabel: string
): Promise<McqRationaleReviewContext> {
  const res = await api.get<McqRationaleReviewContext>("/admin/exam-question-rationale-review-context", {
    params: { questionId, partLabel },
  });
  return res.data;
}
