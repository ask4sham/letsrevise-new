/**
 * PR-024: Topic summary API — teacher/admin only.
 */
import api from "../services/api";

export type TopicSummaryMode = "overview" | "lessonPlan" | "revisionSheet" | "examFocus";

export type TopicSummaryUsedSource = {
  knowledgeDocumentId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  topicKey: string;
  score: number;
};

export type TopicSummaryCitation = {
  knowledgeDocumentId: string;
  sourceType: string;
  sourceId: string;
  quote: string;
  reason: string;
  externalUrl?: string;
};

export type LessonPlanSegment = {
  minutes: string;
  title: string;
  teacherScript: string;
  activity: string;
  checkForUnderstanding: string;
};

export type RevisionSheetSection = {
  commonMistakes: string[];
  memoryCues: string[];
  flashcards: Array<{ front: string; back: string }>;
};

export type ExamFocusSection = {
  commandWords: string[];
  examTips: string[];
  examQuestion: {
    question: string;
    answer: string;
    markScheme: string;
    marks: number;
  };
};

export type TopicSummarySections = {
  lessonPlan?: {
    durationMinutes: number;
    segments: LessonPlanSegment[];
  };
  revisionSheet?: RevisionSheetSection;
  examFocus?: ExamFocusSection;
};

export type TopicSummarySummary = {
  summary: string;
  keyPoints: string[];
  sections: TopicSummarySections;
  citations: TopicSummaryCitation[];
  warnings: string[];
};

export type TopicSummaryResponse = {
  specKey: string;
  topicKey: string;
  mode: TopicSummaryMode;
  confidenceLevel: "strong" | "moderate" | "weak";
  confidenceReason: string;
  confidenceSignals?: {
    topScore: number | null;
    sources: { spec: number; lesson: number; teacherNote?: number; external?: number; total: number };
    warnings: string[];
  };
  usedSources: TopicSummaryUsedSource[];
  externalUsed?: boolean;
  summary: TopicSummarySummary;
  topicSummaryLogId?: string;
  cached?: boolean;
};

export type PostTopicSummaryParams = {
  specKey: string;
  topicKey: string;
  mode?: TopicSummaryMode;
  maxSources?: number;
  allowExternal?: boolean;
};

export async function postTopicSummary(
  params: PostTopicSummaryParams
): Promise<TopicSummaryResponse> {
  const res = await api.post<TopicSummaryResponse>("/topic-summary", {
    specKey: params.specKey.trim(),
    topicKey: params.topicKey.trim(),
    mode: params.mode ?? "overview",
    maxSources: params.maxSources ?? 14,
    allowExternal: params.allowExternal ?? false,
  });
  return res.data;
}

/** PR-027: Topic summary log list item */
export type TopicSummaryLogItem = {
  _id: string;
  specKey: string;
  topicKey: string;
  mode: TopicSummaryMode;
  allowExternal: boolean;
  externalUsed: boolean;
  confidenceLevel: "strong" | "moderate" | "weak" | null;
  createdAt: string;
};

/** PR-027: List logs response */
export type TopicSummaryLogsResponse = {
  items: TopicSummaryLogItem[];
  pagination: {
    limit: number;
    hasMore: boolean;
    oldestReturnedAt: string | null;
  };
};

/** PR-027: Full log for re-opening modal (matches TopicSummaryResponse shape) */
export type TopicSummaryLogFull = {
  _id: string;
  specKey: string;
  topicKey: string;
  mode: TopicSummaryMode;
  allowExternal: boolean;
  externalUsed: boolean;
  confidenceLevel: "strong" | "moderate" | "weak" | null;
  confidenceReason: string | null;
  summary: TopicSummarySummary;
  usedSources: TopicSummaryUsedSource[];
  topicSummaryLogId: string;
};

export type GetTopicSummaryLogsParams = {
  specKey: string;
  topicKey: string;
  limit?: number;
  before?: string;
};

export async function getTopicSummaryLogs(
  params: GetTopicSummaryLogsParams
): Promise<TopicSummaryLogsResponse> {
  const search = new URLSearchParams();
  search.set("specKey", params.specKey.trim());
  search.set("topicKey", params.topicKey.trim());
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.before) search.set("before", params.before);
  const res = await api.get<TopicSummaryLogsResponse>(`/topic-summary/logs?${search.toString()}`);
  return res.data;
}

export async function getTopicSummaryLogById(id: string): Promise<TopicSummaryLogFull> {
  const res = await api.get<TopicSummaryLogFull>(`/topic-summary/logs/${encodeURIComponent(id)}`);
  return res.data;
}

/** PR-029: Convert topic summary to draft lesson */
export type PostTopicSummaryToLessonParams = {
  topicSummaryLogId: string;
  lessonTitle?: string;
  strategy?: "standard" | "exam";
  includeCheckpoint?: boolean;
};

export type TopicSummaryToLessonResponse = {
  lessonId: string;
  lessonUrlEdit: string;
  lessonUrlView: string;
  createdFrom: { topicSummaryLogId: string };
};

export async function postTopicSummaryToLesson(
  params: PostTopicSummaryToLessonParams
): Promise<TopicSummaryToLessonResponse> {
  const res = await api.post<TopicSummaryToLessonResponse>("/topic-summary/to-lesson", {
    topicSummaryLogId: params.topicSummaryLogId.trim(),
    lessonTitle: params.lessonTitle,
    strategy: params.strategy ?? "standard",
    includeCheckpoint: params.includeCheckpoint ?? true,
  });
  return res.data;
}
