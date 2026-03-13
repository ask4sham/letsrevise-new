/**
 * Content Graph API — topic/lesson graph, coverage, rebuild.
 * Teacher/admin only.
 */
import api from "../services/api";

/** TopicCoverageRow: per-topic coverage from spec-coverage API. */
export type TopicCoverageRow = {
  lessonCount: number;
  flashcardCount: number;
  quizCount: number;
  examQuestionCount: number;
  issueCount?: number;
  coverageScore: number;
  status: "weak" | "partial" | "strong";
  weakAreas: string[];
  unit?: string;
  unitKey?: string;
  specKey?: string;
  topicKey?: string;
};

export type TopicCoverage = TopicCoverageRow;

export type SpecCoverageResponse = {
  specKey: string;
  topics: TopicCoverageRow[];
  totalTopics: number;
};

export type LessonGraphResponse = {
  lessonNode: { _id: string } | null;
  topicNodes: Array<{ _id: string; title?: string; topicKey?: string }>;
  lesson: { _id: string; title?: string; topicKey?: string; specKey?: string };
};

/** Get full spec coverage (all topics with counts and scores). GET /api/content-graph/spec-coverage/:specKey */
export async function fetchSpecCoverage(specKey: string): Promise<SpecCoverageResponse> {
  const res = await api.get<SpecCoverageResponse>(`/content-graph/spec-coverage/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Get single topic coverage. GET /api/content-graph/coverage/:specKey/:topicKey */
export async function fetchTopicCoverage(
  specKey: string,
  topicKey: string
): Promise<TopicCoverage> {
  const res = await api.get<TopicCoverage>(
    `/content-graph/coverage/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}

/** Get lesson graph: lesson node + linked topics. GET /api/content-graph/lesson/:lessonId */
export async function fetchLessonGraph(lessonId: string): Promise<LessonGraphResponse> {
  const res = await api.get<LessonGraphResponse>(`/content-graph/lesson/${encodeURIComponent(lessonId)}`);
  return res.data;
}

/** Rebuild graph for a lesson. POST /api/content-graph/rebuild/lesson/:lessonId */
export async function rebuildLessonGraph(lessonId: string): Promise<{ ok: boolean; lessonNode?: string }> {
  const res = await api.post<{ ok: boolean; lessonNode?: string }>(`/content-graph/rebuild/lesson/${lessonId}`);
  return res.data;
}

/** Rebuild graph for a topic. POST /api/content-graph/rebuild/topic body: { specKey, topicKey } */
export async function rebuildTopicGraph(specKey: string, topicKey: string): Promise<{
  ok: boolean;
  topicNode?: string;
  lessonCount: number;
  flashcardCount: number;
  quizCount: number;
  examCount: number;
}> {
  const res = await api.post("/content-graph/rebuild/topic", { specKey, topicKey });
  return res.data;
}

/** Rebuild graph for all topics in a spec. POST /api/content-graph/rebuild/spec/:specKey */
export async function rebuildSpecGraph(specKey: string): Promise<{
  ok: boolean;
  specKey: string;
  topicsRebuilt: number;
  lessonLinksCreated: number;
  flashcardLinksCreated: number;
}> {
  const res = await api.post(`/content-graph/rebuild/spec/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Topic gap analysis (Curriculum Gap Detection) */
export type TopicGap = {
  specKey: string;
  topicKey: string;
  topicTitle: string;
  unit?: string;
  unitKey?: string;
  counts: { lessons: number; flashcards: number; quizzes: number; examQuestions: number; openIssues: number };
  coverageScore: number;
  coverageStatus: "weak" | "partial" | "strong";
  weakAreas: string[];
  gapFlags: {
    missingLesson: boolean;
    lowFlashcards: boolean;
    lowQuizzes: boolean;
    lowExamQuestions: boolean;
    highIssueRate: boolean;
    unresolvedMappings: boolean;
  };
  priorityScore: number;
  recommendations: string[];
  suggestedActions: Array<{ type: string; label: string; reason: string }>;
  summaryParagraph?: string;
};

export type SpecGapsResponse = {
  specKey: string;
  summary: {
    totalTopics: number;
    weakTopics: number;
    partialTopics: number;
    strongTopics: number;
    highestPriorityCount: number;
  };
  gaps: TopicGap[];
};

/** Get spec-level gap analysis. GET /api/content-graph/gaps/:specKey */
export async function fetchSpecGaps(specKey: string): Promise<SpecGapsResponse> {
  const res = await api.get<SpecGapsResponse>(`/content-graph/gaps/${encodeURIComponent(specKey)}`);
  return res.data;
}

/** Get single topic gap analysis. GET /api/content-graph/gaps/:specKey/:topicKey */
export async function fetchTopicGap(specKey: string, topicKey: string): Promise<TopicGap> {
  const res = await api.get<TopicGap>(
    `/content-graph/gaps/${encodeURIComponent(specKey)}/${encodeURIComponent(topicKey)}`
  );
  return res.data;
}
