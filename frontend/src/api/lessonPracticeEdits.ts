import api from "../services/api";

export type LessonEditPayload = {
  type: "mcq" | "short";
  question: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  correctIndex?: number;
  markScheme?: string[];
  explanation?: string;
};

export type PracticeQuestionEffective = {
  id?: string;
  question?: string;
  type?: string;
  marks?: number;
  options?: string[];
  correctAnswer?: string;
  markScheme?: string[];
  explanation?: string;
  topicKey?: string;
  topic?: string;
  imageUrl?: string;
};

export type PracticeQuestionAttachment = {
  questionId: string;
  slotIndex: number;
  addedAt?: string;
  editable: boolean;
  unsupportedReason?: string;
  hasLessonEdit: boolean;
  available: boolean;
  master: PracticeQuestionEffective | null;
  effective: PracticeQuestionEffective | null;
  lessonEdit: LessonEditPayload | null;
};

export type LessonExamQuestionsResponse = {
  questions?: Array<{
    _id: string;
    question: string;
    type?: string;
    marks?: number;
    topicKey?: string;
    topic?: string;
  }>;
  attachments?: PracticeQuestionAttachment[];
};

export async function fetchLessonExamQuestionAttachments(
  lessonId: string
): Promise<PracticeQuestionAttachment[]> {
  const res = await api.get<LessonExamQuestionsResponse>(`/lessons/${lessonId}/exam-questions`);
  return Array.isArray(res.data?.attachments) ? res.data.attachments : [];
}

export async function saveLessonExamQuestionEdits(
  lessonId: string,
  edits: Array<{ questionId: string; lessonEdit: LessonEditPayload | null }>
): Promise<{ ok?: boolean; results?: unknown[] }> {
  const res = await api.put<{ ok?: boolean; results?: unknown[] }>(
    `/lessons/${lessonId}/exam-questions/lesson-edits`,
    { edits }
  );
  return res.data ?? {};
}

export async function removeLessonExamQuestion(
  lessonId: string,
  questionId: string
): Promise<void> {
  await api.delete(`/lessons/${lessonId}/exam-questions/${questionId}`);
}
