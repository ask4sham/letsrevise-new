/**
 * PR-038: Study coach API — personalised study plan.
 */
import api from "../services/api";

export interface StudyPlanAction {
  id: string;
  label: string;
  href: string;
}

export interface StudyPlanItem {
  topicKey: string;
  masteryScore: number;
  confidenceBand: "low" | "medium" | "high";
  status: "new" | "learning" | "practising" | "secure";
  nextAction: string;
  reason: string;
  coverageStatus: string;
  demandScore: number;
  actions: StudyPlanAction[];
}

export interface StudyPlanResponse {
  specKey: string;
  generatedAt: string;
  plan: StudyPlanItem[];
}

/**
 * Fetch personalised study plan for a spec.
 */
export async function getStudyPlan(specKey: string): Promise<StudyPlanResponse> {
  const res = await api.get<StudyPlanResponse>("/study-coach/plan", {
    params: { specKey: specKey?.trim() || "" },
  });
  return res.data;
}

/**
 * POST /api/progress/lesson-view — record lesson view (student only).
 */
export async function postLessonView(
  specKey: string,
  topicKey: string,
  lessonId?: string
): Promise<void> {
  await api.post("/progress/lesson-view", { specKey, topicKey, lessonId });
}

/**
 * POST /api/progress/lesson-completion — record lesson completion (student only).
 */
export async function postLessonCompletion(
  specKey: string,
  topicKey: string,
  lessonId?: string,
  timeSpentSeconds?: number
): Promise<void> {
  await api.post("/progress/lesson-completion", {
    specKey,
    topicKey,
    lessonId,
    timeSpentSeconds,
  });
}

/**
 * POST /api/progress/flashcard-review — record flashcard review (student only).
 * Actionable revision flow: LearningEvidenceEvent flashcard_review.
 */
export async function postFlashcardReview(
  specKey: string,
  topicKey: string,
  flashcardId?: string,
  difficultyRating?: number
): Promise<void> {
  await api.post("/progress/flashcard-review", {
    specKey,
    topicKey,
    flashcardId,
    difficultyRating,
  });
}
