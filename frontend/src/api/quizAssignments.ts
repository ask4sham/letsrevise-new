/**
 * PR-EDGE-4.1: Quiz/Assessment assignment by shareId for /q/:shareId.
 */
import api from "../services/api";

export type QuizAssignmentSharePayload = {
  assignment: {
    _id: string;
    shareId: string;
    kind: "quiz" | "assessment";
    title: string;
    isActive: boolean;
    dueAt: string | null;
    lessonId?: string | null;
    paperId?: string | null;
  };
  lesson?: { _id: string; title: string } | null;
  paper?: { _id: string; title: string } | null;
  closed?: boolean;
};

export async function getQuizAssignmentByShareId(shareId: string): Promise<QuizAssignmentSharePayload> {
  const { data } = await api.get<QuizAssignmentSharePayload>(
    `/quiz-assignments/share/${encodeURIComponent(shareId)}`
  );
  return data!;
}
