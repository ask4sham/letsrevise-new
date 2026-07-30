/**
 * Admin read-only Exam Question view API client.
 * GET only — no mutation methods.
 */
import api from "../services/api";

export type AdminExamQuestionOption = {
  index: number;
  text: string;
  isCorrect: boolean;
};

export type AdminExamQuestionPart = {
  label: string;
  type: string;
  marks: number | null;
  questionText: string;
  options: AdminExamQuestionOption[];
  correctIndex: number | null;
  markScheme: string[];
};

export type AdminExamQuestionMediaAssetSummary = {
  type: string;
  referencePresent: boolean;
  hasAlt: boolean;
};

export type AdminExamQuestionMediaSummary = {
  questionImagePresent: boolean;
  assetCount: number;
  assets: AdminExamQuestionMediaAssetSummary[];
};

export type AdminExamQuestionView = {
  id: string;
  question: string;
  title: string;
  sharedStem: string;
  subject: string;
  examBoard: string;
  level: string;
  topic: string;
  topicKey: string;
  type: string;
  questionMode: string;
  status: string;
  marks: number | null;
  totalMarks: number | null;
  options: AdminExamQuestionOption[];
  correctIndex: number | null;
  correctAnswer: string | null;
  markScheme: string[];
  parts: AdminExamQuestionPart[];
  mediaSummary: AdminExamQuestionMediaSummary;
  ownerName: string;
  createdAt: string | null;
  updatedAt: string | null;
  readOnly: true;
};

export type AdminExamQuestionViewError = {
  error?: string;
  code?: string;
};

export async function fetchAdminExamQuestionView(questionId: string): Promise<AdminExamQuestionView> {
  const res = await api.get<AdminExamQuestionView>(
    `/admin/question-banks/exam-questions/${encodeURIComponent(questionId)}`
  );
  return res.data;
}
