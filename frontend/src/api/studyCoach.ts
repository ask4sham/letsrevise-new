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
export async function postLessonView(specKey: string, topicKey: string): Promise<void> {
  await api.post("/progress/lesson-view", { specKey, topicKey });
}
