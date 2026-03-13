/**
 * PR-EDGE-4: Student My Work API
 */
import api from "../services/api";

export type MyWorkItem = {
  id: string;
  type: "worksheet" | "quiz" | "assessment";
  title: string;
  status: string;
  rawStatus: string;
  dueAt: string | null;
  released: boolean;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  linkTo: string;
  /** For worksheets: attempt view when released; falls back to linkTo for quizzes */
  viewLink?: string;
  assignmentId?: string;
  paperId?: string;
};

export type MyWorkResponse = {
  worksheets: MyWorkItem[];
  quizzes: MyWorkItem[];
  assessments: MyWorkItem[];
};

export async function getStudentMyWork(): Promise<MyWorkResponse> {
  const res = await api.get<MyWorkResponse>("/student/my-work");
  return res.data!;
}
