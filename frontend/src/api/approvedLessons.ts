import api from "../services/api";

export type ApprovedLessonCard = {
  _id: string;
  id: string;
  title: string;
  subject: string;
  level: string;
  board?: string;
  examBoard?: string;
  topic?: string;
  tier?: string;
  teacherId?: string;
  teacherName?: string;
  letsReviseApproved?: boolean;
  catalogueVersion?: number | null;
  approvedAt?: string | null;
};

export async function fetchApprovedLessons(): Promise<ApprovedLessonCard[]> {
  const res = await api.get<{ lessons?: ApprovedLessonCard[] }>("/lessons/approved-lessons");
  const rows = Array.isArray(res.data?.lessons) ? res.data.lessons : [];
  return rows.map((l) => ({
    ...l,
    _id: String(l._id || l.id),
    id: String(l._id || l.id),
  }));
}
