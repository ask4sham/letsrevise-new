/**
 * PR-BETA-OPS-1: Create student–teacher link (teacher/admin only).
 * Backend: POST /api/admin/student-teacher-links { studentId, teacherId }
 */
import api from "../services/api";

export async function createStudentTeacherLink(params: {
  studentId: string;
  teacherId: string;
}) {
  const { studentId, teacherId } = params;

  const res = await api.post("/admin/student-teacher-links", {
    studentId,
    teacherId,
  });

  return res.data as {
    linkId?: string;
    ok?: boolean;
    message?: string;
    [key: string]: any;
  };
}
