import React from "react";
import { Navigate, useParams } from "react-router-dom";

/**
 * Teacher Open Classroom → student lesson renderer (mode=classroom).
 * Keeps /teacher/classroom/:lessonId links working without a duplicate renderer.
 */
const TeacherClassroomRedirect: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  if (!lessonId) {
    return <Navigate to="/teacher-dashboard" replace />;
  }
  return <Navigate to={`/lesson/${lessonId}?mode=classroom`} replace />;
};

export default TeacherClassroomRedirect;
