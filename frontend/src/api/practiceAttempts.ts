/**
 * PR-PRACTICE-LOOP-1 Frontend: Submit practice attempt (MCQ: selectedChoiceIndex; others: isCorrect).
 * Frozen-set resume: include practiceSetId so the server can enforce item-level ownership.
 * Correctness for quiz_mcq is computed server-side and returned after submit.
 */
import api from "../services/api";

export type SubmitPracticeAttemptPayload = {
  teacherId: string;
  specKey: string;
  topicKey: string;
  contentType: string;
  contentId: string;
  /** Required for no-link students answering a frozen PracticeSet item. */
  practiceSetId?: string;
  confidence?: number;
  timeSpentSec?: number;
} & (
  | { contentType: "quiz_mcq"; selectedChoiceIndex: number }
  | { contentType: string; isCorrect: boolean }
);

/** Server-grounded post-submit feedback (never invent on the client). */
export type SubmitPracticeAttemptResponse = {
  ok: true;
  attemptId?: string;
  /** Present when the server computed or accepted an outcome. */
  isCorrect?: boolean;
  /** MCQ only — revealed after successful submit. */
  correctChoiceIndex?: number;
  /** Optional server explanation / feedback text. */
  explanation?: string;
  feedback?: string;
};

export async function submitPracticeAttempt(
  payload: SubmitPracticeAttemptPayload
): Promise<SubmitPracticeAttemptResponse> {
  const body: Record<string, unknown> = {
    teacherId: payload.teacherId,
    specKey: payload.specKey,
    topicKey: payload.topicKey,
    contentType: payload.contentType,
    contentId: payload.contentId,
  };
  if (payload.practiceSetId) body.practiceSetId = payload.practiceSetId;
  if (payload.confidence != null) body.confidence = payload.confidence;
  if (payload.timeSpentSec != null) body.timeSpentSec = payload.timeSpentSec;

  if (payload.contentType === "quiz_mcq") {
    body.selectedChoiceIndex = (payload as { selectedChoiceIndex: number }).selectedChoiceIndex;
  } else {
    body.isCorrect = (payload as { isCorrect: boolean }).isCorrect;
  }

  const res = await api.post<SubmitPracticeAttemptResponse>(
    "/practice-attempts",
    body
  );
  return res.data;
}
