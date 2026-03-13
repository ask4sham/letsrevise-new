/**
 * PR-PRACTICE-LOOP-1: Practice set, submit attempt, teacher topic stats.
 */
import api from "../services/api";

export type PracticeSetItem = {
  sourceType: "examQuestion" | "pastPaperQuestion";
  sourceId: string;
  teacherId: string;
  question: string;
  marks: number | null;
  topicKey: string;
};

export type PracticeSetResponse = {
  items: PracticeSetItem[];
};

export async function fetchPracticeSet(params: {
  specKey: string;
  topicKey: string;
  count?: number;
  teacherId?: string;
}): Promise<PracticeSetResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("specKey", params.specKey);
  searchParams.set("topicKey", params.topicKey);
  if (params.count != null) searchParams.set("count", String(Math.min(30, Math.max(1, params.count))));
  if (params.teacherId) searchParams.set("teacherId", params.teacherId);

  const res = await api.get<PracticeSetResponse>(`/practice/set?${searchParams.toString()}`);
  return res.data;
}

export type PostAttemptParams = {
  specKey: string;
  topicKey: string;
  sourceType: "examQuestion" | "pastPaperQuestion";
  sourceId: string;
  outcome: "correct" | "partial" | "wrong";
  confidence?: number;
  teacherId: string;
};

export async function postPracticeAttempt(params: PostAttemptParams): Promise<{ success: boolean; attemptId: string }> {
  const res = await api.post<{ success: boolean; attemptId: string }>("/practice/attempt", {
    specKey: params.specKey,
    topicKey: params.topicKey,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    outcome: params.outcome,
    confidence: params.confidence,
    teacherId: params.teacherId,
  });
  return res.data;
}

export type TopicStat = {
  topicKey: string;
  attempts: number;
  correct: number;
  partial: number;
  wrong: number;
  accuracy: number | null;
  lastAttempt: string | null;
};

export type TopicStatsResponse = {
  specKey: string;
  topics: TopicStat[];
};

export async function fetchTopicStats(params: { specKey: string }): Promise<TopicStatsResponse> {
  const res = await api.get<TopicStatsResponse>(`/practice/stats/topics?specKey=${encodeURIComponent(params.specKey)}`);
  return res.data;
}
