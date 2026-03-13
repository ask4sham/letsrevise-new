/**
 * PR-EDGE-5: Teacher question-level analytics.
 * PR-PRACTICE-LOOP-1: Topic performance (attempts, accuracy, last attempt) — lowest accuracy first.
 */
import api from "../services/api";

export type TopicPerformanceRow = {
  topicKey: string;
  attempts: number;
  correct: number;
  accuracy: number;
  lastAttemptAt: string | null;
};

export async function getTopicPerformance(specKey: string): Promise<TopicPerformanceRow[]> {
  const res = await api.get<TopicPerformanceRow[]>(
    `/teacher/analytics/topic-performance?specKey=${encodeURIComponent(specKey)}`
  );
  return res.data ?? [];
}

export type QuestionAnalyticsItem = {
  questionId: string;
  questionPreview: string;
  attempts: number;
  correct: number;
  percentCorrect: number | null;
};

export type QuestionAnalyticsResponse = {
  topicKey: string;
  items: QuestionAnalyticsItem[];
};

export async function getQuestionAnalytics(topicKey: string, days?: number): Promise<QuestionAnalyticsResponse> {
  const params = new URLSearchParams({ topicKey });
  if (days != null) params.set("days", String(days));
  const res = await api.get<QuestionAnalyticsResponse>(`/teacher/analytics/questions?${params.toString()}`);
  return res.data!;
}
