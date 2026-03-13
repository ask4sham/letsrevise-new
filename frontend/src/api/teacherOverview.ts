/**
 * PR-EDGE-3: Teacher overview dashboard API.
 */
import api from "../services/api";

export type OverviewCountLink = { count: number; link: string };

export type TeacherOverview = {
  ok?: boolean;
  needsMarking: { worksheets: OverviewCountLink };
  awaitingRelease: {
    worksheets: OverviewCountLink;
    quizzes: OverviewCountLink;
    assessments: OverviewCountLink;
  };
  dueSoon: {
    worksheets: OverviewCountLink;
    quizzes: OverviewCountLink;
    assessments: OverviewCountLink;
  };
  /** PR-EDGE-5: quiz/assessment submissions today */
  quizSubmissionsToday?: number;
  /** PR-EDGE-5: attempts with score < 40% */
  lowScoreCount?: number;
  /** PR-EDGE-5: total awaiting release (worksheets + quizzes + assessments) */
  awaitingReleaseTotal?: number;
  recentActivity: Array<{
    type: "worksheet" | "quiz" | "assessment";
    submittedAt: string | null;
    label: string;
    link: string;
  }>;
};

export async function getTeacherOverview(): Promise<TeacherOverview> {
  const res = await api.get<TeacherOverview>("/teacher/overview");
  return res.data!;
}

/** PR-EDGE-5.1: At-risk drill-down — low-score attempts */
export type AtRiskItem = {
  type: "worksheet" | "quiz" | "assessment";
  attemptId: string;
  submittedAt: string | null;
  score: number;
  maxScore: number;
  ratio: number;
  title: string;
  topicKey: string;
  isReleased: boolean;
  link: string;
};

export type TeacherAtRiskResponse = {
  ok: boolean;
  threshold: number;
  days: number;
  items: AtRiskItem[];
};

export async function getTeacherAtRisk(params: {
  threshold?: number;
  days?: number;
  type?: "worksheet" | "quiz" | "assessment" | "all";
  limit?: number;
}): Promise<TeacherAtRiskResponse> {
  const res = await api.get<TeacherAtRiskResponse>("/teacher/at-risk", { params });
  return res.data!;
}

/** PR-EDGE-5.2: One-click remedial assignment from at-risk */
export type AssignRemedialResponse = {
  ok: boolean;
  topicKey: string;
  kind: "quiz" | "assessment";
  lessonId: string;
  assignmentId: string;
  shareId: string;
  shareUrl: string;
  generated: { addedCount: number; questionsCount: number };
};

export async function assignRemedialFromAtRisk(params: {
  topicKey: string;
  kind: "quiz" | "assessment";
  dueAt?: string;
}): Promise<AssignRemedialResponse> {
  const res = await api.post<AssignRemedialResponse>("/teacher/at-risk/assign", params);
  return res.data!;
}
