/**
 * PR-COVERAGE-1: Teacher topic coverage API — counts per taxonomy topic.
 */
import api from "../services/api";
import type { SpecKey } from "./taxonomy";

export type TopicCoverageRow = {
  topic: string;
  topicKey: string;
  namespacedTopicKey: string;
  counts: {
    flashcards: number;
    quiz_mcq: number;
    quiz_short: number;
    examQuestions: number;
    pastPaperQuestions: number;
  };
  coverage: { any: boolean; score: number; outOf: number };
};

export type TopicCoverageUnit = {
  unit: string;
  topics: TopicCoverageRow[];
};

export type TopicCoverageResponse = {
  specKey: SpecKey;
  units: TopicCoverageUnit[];
  totals: { topics: number; topicsWithAny: number; topicsFullyCovered: number };
};

/** Coverage request can be heavier; allow 20s before client timeout (504 often from proxy). */
const COVERAGE_REQUEST_TIMEOUT_MS = 20000;

export async function fetchTopicCoverage(specKey: SpecKey): Promise<TopicCoverageResponse> {
  const res = await api.get<TopicCoverageResponse>("/teacher/topic-coverage", {
    params: { specKey },
    timeout: COVERAGE_REQUEST_TIMEOUT_MS,
  });
  return res.data;
}
