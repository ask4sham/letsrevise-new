/**
 * PR — Adaptive Testing Loop: Topic mastery API.
 */
import api from "../services/api";

export interface MasteryRecord {
  topicKey: string;
  attempts: number;
  correct: number;
  masteryScore: number;
}

export interface MasteryAggregateTopic {
  topicKey: string;
  topicTitle: string;
  avgMastery: number;
  studentCount: number;
  strugglingCount: number;
}

export interface MasteryAggregateResponse {
  specKey: string;
  topics: MasteryAggregateTopic[];
  generatedAt: string;
}

/**
 * Record a quiz question answer (student only).
 */
export async function recordMastery(topicKey: string, correct: boolean): Promise<MasteryRecord> {
  const res = await api.post<MasteryRecord>("/mastery/record", { topicKey, correct });
  return res.data;
}

/**
 * Get mastery for current user for a topic (student only).
 */
export async function getMastery(topicKey: string): Promise<MasteryRecord> {
  const res = await api.get<MasteryRecord>("/mastery", { params: { topicKey } });
  return res.data;
}

/**
 * Get aggregate mastery across linked students (teacher/admin only).
 */
export async function getMasteryAggregate(specKey: string): Promise<MasteryAggregateResponse> {
  const res = await api.get<MasteryAggregateResponse>("/mastery/aggregate", {
    params: { specKey },
  });
  return res.data;
}
