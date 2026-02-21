/**
 * PR-Q1: Topic Quiz Bank API (teacher/admin only).
 */
import api from "../services/api";

export type TopicQuizQuestion = {
  _id: string;
  ownerId: string;
  topicKey: string;
  kind?: QuizKind;
  questionText: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
  tags?: string[];
  status: "draft" | "published";
  createdAt?: string;
  updatedAt?: string;
};

export type QuizKind = "quiz" | "assessment";

export type ListParams = {
  topicKey: string;
  status?: "draft" | "published" | "all";
  mineOnly?: boolean;
  kind?: QuizKind;
};

export type BulkPreviewSummary = {
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  duplicatesInPayload: number;
  duplicatesInDb: number;
  wouldCreate: number;
};

export type BulkPreviewResponse = {
  ok: boolean;
  topicKey: string;
  summary: BulkPreviewSummary;
  invalid: Array<{ index: number; reason: string; raw: string }>;
  duplicates: {
    inPayload: Array<{ index: number; questionText: string; choices: string[] }>;
    inDb: Array<{ questionText: string; choices: string[] }>;
  };
  previewItems: Array<{
    questionText: string;
    choices: string[];
    correctIndex: number;
    explanation?: string;
    tags: string[];
    fingerprint: string;
  }>;
};

export async function listTopicQuizQuestions(
  topicKey: string,
  opts: { status?: ListParams["status"]; mineOnly?: boolean; kind?: QuizKind } = {}
): Promise<TopicQuizQuestion[]> {
  const q = new URLSearchParams();
  q.set("topicKey", topicKey);
  if (opts.status) q.set("status", opts.status);
  if (opts.mineOnly) q.set("mineOnly", "1");
  if (opts.kind) q.set("kind", opts.kind);
  const res = await api.get<{ items: TopicQuizQuestion[] }>(`/topic-quiz-questions?${q.toString()}`);
  return res.data?.items ?? [];
}

export async function previewBulkImportTopicQuizQuestions(params: {
  topicKey: string;
  format: "json" | "csv";
  text: string;
  dedupeMode?: "skip" | "error" | "allow";
  csvOptions?: { delimiter?: "," | "\t" | ";" };
  kind?: QuizKind;
}): Promise<BulkPreviewResponse> {
  const res = await api.post<BulkPreviewResponse>("/topic-quiz-questions/bulk/preview", {
    topicKey: params.topicKey,
    format: params.format,
    text: params.text,
    dedupeMode: params.dedupeMode ?? "skip",
    csvOptions: params.csvOptions,
    kind: params.kind ?? "quiz",
  });
  return res.data!;
}

export async function bulkCreateTopicQuizQuestions(body: {
  topicKey: string;
  items: Array<{
    questionText: string;
    choices: string[];
    correctIndex: number;
    explanation?: string;
    tags?: string[];
  }>;
  dedupeMode?: "skip" | "error" | "allow";
  kind?: QuizKind;
}): Promise<{
  ok: boolean;
  createdCount: number;
  skipped: { duplicatesInPayload: number; duplicatesInDb: number; invalid: number };
  createdIds: string[];
}> {
  const res = await api.post<{
    ok: boolean;
    createdCount: number;
    skipped: { duplicatesInPayload: number; duplicatesInDb: number; invalid: number };
    createdIds: string[];
  }>("/topic-quiz-questions/bulk", {
    topicKey: body.topicKey,
    items: body.items,
    dedupeMode: body.dedupeMode ?? "skip",
    kind: body.kind ?? "quiz",
  });
  return res.data!;
}

export async function publishTopicQuizQuestion(id: string): Promise<TopicQuizQuestion> {
  const res = await api.post<{ question: TopicQuizQuestion }>(`/topic-quiz-questions/${id}/publish`, {});
  return res.data!.question;
}

export async function unpublishTopicQuizQuestion(id: string): Promise<TopicQuizQuestion> {
  const res = await api.post<{ question: TopicQuizQuestion }>(`/topic-quiz-questions/${id}/unpublish`, {});
  return res.data!.question;
}

export async function deleteTopicQuizQuestion(id: string): Promise<void> {
  await api.delete(`/topic-quiz-questions/${id}`);
}

/** PR-A1: Generate assessment from topic bank (kind=assessment, published-only, replace). */
export async function generateAssessmentFromTopic(lessonId: string): Promise<{
  ok: boolean;
  addedCount: number;
  questionsCount: number;
  lesson: any;
}> {
  const res = await api.post<{
    ok: boolean;
    addedCount: number;
    questionsCount: number;
    lesson: any;
  }>(`/lessons/${lessonId}/generate/assessment-from-topic`);
  return res.data!;
}

/** PR-Q2: Generate quiz from topic bank into lesson (published-only, replace). */
export async function generateQuizFromTopic(lessonId: string): Promise<{
  ok: boolean;
  addedCount: number;
  questionsCount: number;
  lesson: any;
}> {
  const res = await api.post<{
    ok: boolean;
    addedCount: number;
    questionsCount: number;
    lesson: any;
  }>(`/lessons/${lessonId}/generate/quiz-from-topic`);
  return res.data!;
}
