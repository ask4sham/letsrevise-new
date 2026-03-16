/**
 * Phase 2 consolidation: Unified student dashboard API.
 * Single endpoint for summary, weakTopics, recentActivity, studyPlan, recommendations.
 */
import api from "../services/api";

export type WeakTopic = {
  topicKey: string;
  topicName: string;
  percentage: number;
  correct: number;
  total: number;
};

export type RecentActivityItem = {
  eventType: string;
  topicKey: string;
  specKey: string;
  createdAt: string | null;
};

export type StudyPlanAction = {
  id: string;
  label: string;
  href: string;
};

export type StudyPlanItem = {
  topicKey: string;
  masteryScore: number;
  confidenceBand: string;
  status: string;
  nextAction: string;
  reason: string;
  coverageStatus: string;
  demandScore: number;
  actions: StudyPlanAction[];
};

export type TopicEvidence = {
  specKey: string;
  topicKey: string;
  quizStats: { attempts: number; correct: number; accuracy: number | null };
  flashcardStats: { reviews: number; averageDifficulty: number | null };
  examStats: { attempts: number; correct: number; accuracy: number | null };
  lessonStats: { completions: number; averageTimeSpent: number | null };
  derivedMetrics: { masteryScore: number | null; difficultyLevel: string };
};

export type LinkedTeacher = {
  teacherId: string;
  teacherName: string;
};

export type AdaptiveRecommendation = {
  topicKey: string;
  topicName: string;
  masteryScore: number | null;
  priorityScore: number;
  reason: string;
  recommendedAction: string;
  adaptiveDifficulty: string;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
};

export type DashboardResponse = {
  ok: boolean;
  summary: { revisionFocus: string };
  weakTopics: WeakTopic[];
  recentActivity: RecentActivityItem[];
  specEvidence?: {
    specKey: string;
    topics: TopicEvidence[];
  };
  studyPlan: {
    specKey: string;
    generatedAt: string;
    plan: StudyPlanItem[];
  };
  linkedTeachers?: LinkedTeacher[];
  dueToday?: AdaptiveRecommendation[];
  overdueTopics?: AdaptiveRecommendation[];
  adaptiveRecommendations?: AdaptiveRecommendation[];
  recommendations: {
    topics: Array<{ topicKey: string; topic: string; score: number; wrong: number; highConfidenceWrong: number }>;
    lessons: Array<{
      id: string;
      title: string;
      topic: string;
      description: string;
      subject: string;
      level: string;
      examBoard: string;
      teacherName: string;
      locked: boolean;
      hasAccess: boolean;
      isFreePreview: boolean;
    }>;
    days: number;
  };
};

export async function getStudentDashboard(opts?: {
  specKey?: string;
  days?: number;
  limit?: number;
}): Promise<DashboardResponse> {
  const params = new URLSearchParams();
  if (opts?.specKey) params.set("specKey", opts.specKey);
  if (opts?.days) params.set("days", String(opts.days));
  if (opts?.limit) params.set("limit", String(opts.limit));
  const res = await api.get<DashboardResponse>(`/student/dashboard?${params.toString()}`);
  return res.data;
}
