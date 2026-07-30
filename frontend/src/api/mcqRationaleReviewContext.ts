/**
 * V2.3B1 read-only MCQ rationale review-context API client.
 * No generate / reject / regenerate / approve / save methods.
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
