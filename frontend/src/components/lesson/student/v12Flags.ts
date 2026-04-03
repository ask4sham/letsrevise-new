/**
 * V12 learner lesson presentation on LessonViewPage (block shells + lessonStudentView.css).
 * Set REACT_APP_V12_STUDENT_LESSON_UI=0 to disable without code changes.
 *
 * @param useV12LearnerLayer pass true whenever the page should show learner-facing blocks
 * (students, teachers previewing, parents, guests). When false, legacy SS1 callouts are used.
 */
export function isV12StudentLessonPresentation(useV12LearnerLayer: boolean): boolean {
  if (typeof process === "undefined") return useV12LearnerLayer;
  return useV12LearnerLayer && process.env.REACT_APP_V12_STUDENT_LESSON_UI !== "0";
}
