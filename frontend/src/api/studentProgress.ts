/**
 * PR-STU-PROGRESS-1: Student "My Progress" API
 */
import api from "../services/api";

export type SubjectProgress = {
  subject: string;
  quizzesAttempted: number;
  averageScore: number | null;
  lastActivityAt: string | null;
};

export type TopicProgress = {
  topicKey: string;
  topicName: string;
  attempted: boolean;
  quizAttempts: number;
  averageScore: number | null;
  needsPractice: boolean;
};

export type StudentProgressResponse = {
  ok: boolean;
  subjects: SubjectProgress[];
  topics: TopicProgress[];
};

export async function getStudentProgress(): Promise<StudentProgressResponse> {
  const res = await api.get<StudentProgressResponse>("/student/progress");
  return res.data!;
}
