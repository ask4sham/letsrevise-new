/**
 * PR-QUESTION-BROWSER-1: Question Browser API — PATCH and by-topic list for teacher QA.
 */
import api from "../services/api";

export type QuizQuestionType = "mcq" | "short-answer";

export type TopicQuizQuestion = {
  _id: string;
  ownerId?: string;
  topicKey: string;
  specKey?: string;
  kind?: "quiz" | "assessment";
  type: QuizQuestionType;
  questionText: string;
  choices: string[];
  correctIndex: number;
  acceptableAnswers?: string[];
  matchMode?: "exact" | "contains";
  explanation?: string;
  status: "draft" | "published";
  isArchived?: boolean;
};

/** PATCH body: backend also accepts correctChoice (letter A–F) for MCQ. */
export type PatchTopicQuizQuestion = Partial<TopicQuizQuestion> & { correctChoice?: string };

export async function patchTopicQuizQuestion(id: string, patch: PatchTopicQuizQuestion) {
  const res = await api.patch<{ item: TopicQuizQuestion }>(`/topic-quiz-questions/${id}`, patch);
  return res.data.item;
}

export type TopicFlashcard = {
  _id: string;
  ownerId?: string;
  topicKey: string;
  front: string;
  back: string;
  status?: "draft" | "published";
  isArchived?: boolean;
};

export async function patchTopicFlashcard(id: string, patch: Partial<TopicFlashcard>) {
  const res = await api.patch<{ item: TopicFlashcard }>(`/topic-flashcards/${id}`, patch);
  return res.data.item;
}

export type ExamQuestion = {
  _id: string;
  topicKey: string;
  specKey: string;
  question: string;
  markScheme: string[] | string;
  marks?: number;
  isArchived?: boolean;
};

/** List teacher's exam questions by spec + topic (uses api auth). */
export async function fetchMyExamQuestionsByTopic(
  specKey: string,
  topicKey: string,
  q?: string,
  limit = 200
): Promise<ExamQuestion[]> {
  const params = new URLSearchParams({ specKey, topicKey, limit: String(limit) });
  if (q && q.trim()) params.set("q", q.trim());
  const res = await api.get<{ items: ExamQuestion[] }>(`/exam-questions/mine?${params.toString()}`);
  return res.data?.items ?? [];
}

export async function patchExamQuestion(id: string, patch: Partial<ExamQuestion>) {
  const res = await api.patch<{ item: ExamQuestion }>(`/exam-questions/${id}`, patch);
  return res.data.item;
}

export type PastPaperQuestion = {
  _id: string;
  topicKey: string;
  question: string;
  markScheme: string[] | string;
  marks?: number;
  questionNumber?: string;
  isArchived?: boolean;
};

export async function fetchPastPaperQuestionsByTopic(
  specKey: string,
  topicKey: string,
  q?: string,
  limit = 200
): Promise<PastPaperQuestion[]> {
  const params = new URLSearchParams({ specKey, topicKey, limit: String(limit) });
  if (q && q.trim()) params.set("q", q.trim());
  const res = await api.get<{ items: PastPaperQuestion[] }>(`/past-paper-questions/by-topic?${params.toString()}`);
  return res.data?.items ?? [];
}

export async function patchPastPaperQuestion(id: string, patch: Partial<PastPaperQuestion>) {
  const res = await api.patch<{ item: PastPaperQuestion }>(`/past-paper-questions/${id}`, patch);
  return res.data.item;
}
