import api from "../services/api";

export type TeacherLibraryTab = "pending" | "approved" | "rejected" | "retired";

export type TeacherLibraryAdminLesson = {
  _id: string;
  id: string;
  title: string;
  subject: string;
  level: string;
  board: string;
  examBoard: string;
  topic: string;
  tier: string;
  status: string;
  isPublished: boolean;
  teacherId: string;
  teacherName: string;
  teacherLibraryStatus: string;
  catalogueVersion: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionNotes: string;
  retiredAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type TeacherLibraryCounts = {
  pending: number;
  pending_review: number;
  approved: number;
  rejected: number;
  retired: number;
};

export async function fetchTeacherLibrarySummary(): Promise<TeacherLibraryCounts> {
  const res = await api.get("/lessons/catalogue-approvals/summary");
  return res.data.counts;
}

export async function fetchTeacherLibraryLessons(
  status: TeacherLibraryTab,
  options?: { sort?: "oldest" | "newest" }
): Promise<TeacherLibraryAdminLesson[]> {
  const res = await api.get("/lessons/catalogue-approvals", {
    params: {
      status,
      sort: status === "pending" ? options?.sort || "newest" : undefined,
    },
  });
  return res.data.lessons || [];
}

export async function approveLessonForCatalogue(lessonId: string): Promise<void> {
  await api.post(`/lessons/${lessonId}/approve-for-catalogue`);
}

export async function rejectLessonForCatalogue(
  lessonId: string,
  notes: string
): Promise<void> {
  await api.post(`/lessons/${lessonId}/reject-for-catalogue`, { notes });
}

export async function retireLessonFromCatalogue(lessonId: string): Promise<void> {
  await api.post(`/lessons/${lessonId}/retire-from-catalogue`);
}
