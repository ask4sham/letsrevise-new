/**
 * Step 6 (LLM Roadmap): Student knowledge gap — weak areas + revision focus summary.
 */
import api from "../services/api";

export type WeakArea = {
  topicKey: string;
  topicName: string;
  attempted: number;
  correct: number;
  total: number;
  percentage: number;
};

export type KnowledgeGapResponse = {
  summary: string;
  weakAreas: WeakArea[];
  _disabled?: boolean;
};

export async function getKnowledgeGap(): Promise<KnowledgeGapResponse> {
  const res = await api.get<KnowledgeGapResponse>("/student/knowledge-gap");
  return res.data;
}
