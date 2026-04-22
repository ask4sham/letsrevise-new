// /frontend/src/App.tsx
// PR-AUTH-UI-2: ProtectedRoute/RoleBasedRedirect use useCurrentUser (no direct localStorage auth reads).
import React, { ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "./hooks/useCurrentUser";
import { clearAuth as clearAuthStorage } from "./utils/authStorage";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ConfirmEmailChangePage from "./pages/ConfirmEmailChangePage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminAuditLogPage from "./pages/AdminAuditLogPage";
import Dashboard from "./pages/Dashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import CreateLessonPage from "./pages/CreateLessonPage";
import LessonViewPage from "./pages/LessonViewPage";
import EditLessonPage from "./pages/EditLessonPage";
import AnalysisPage from "./pages/AnalysisPage";
import StudentProgressPage from "./pages/StudentProgressPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import TeacherPayoutPage from "./pages/TeacherPayoutPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import ParentDashboard from "./pages/ParentDashboard";

// ✅ DEMO lesson page (keep)
import LessonDemoPage from "./pages/LessonDemoPage";

// Existing page (leave as-is)
import SubjectOptionsPage from "./pages/SubjectOptionsPage";

// ✅ Real browse lessons page
import BrowseLessonsPage from "./pages/BrowseLessonsPage";

// ✅ Admin "View" profile route page
import ProfilePage from "./pages/ProfilePage";

// ✅ My Profile page (current user)
import UserProfilePage from "./pages/UserProfilePage";

// ✅ Edit My Profile page
import EditProfilePage from "./pages/EditProfilePage";

// ✅ Admin "View Lesson" route page (for /admin/lesson/:id)
import AdminLessonViewPage from "./pages/AdminLessonViewPage";
// PR9: Teacher classroom delivery view
import ClassroomModePage from "./pages/ClassroomModePage";
// PR10: Biology readiness report
import BiologyReadinessReportPage from "./pages/BiologyReadinessReportPage";
import LessonAttemptReportPage from "./pages/LessonAttemptReportPage";
import TeacherAttemptsSummaryPage from "./pages/TeacherAttemptsSummaryPage";
import TeacherAtRiskPage from "./pages/TeacherAtRiskPage";
import TeacherNeedsAttentionPage from "./pages/TeacherNeedsAttentionPage";
import TeacherMisconceptionsPage from "./pages/TeacherMisconceptionsPage";
import TeacherReteachPlansPage from "./pages/TeacherReteachPlansPage";
import AdminMetricsPage from "./pages/AdminMetricsPage";
import AdminIngestPage from "./pages/AdminIngestPage";
import AdminQuestionBanksPage from "./pages/AdminQuestionBanksPage";
import AdminTaxonomyPage from "./pages/AdminTaxonomyPage";
import ContentCoveragePage from "./pages/ContentCoveragePage";
import AdminLaunchCoveragePage from "./pages/AdminLaunchCoveragePage";
import TopicCommandCenterPage from "./pages/TopicCommandCenterPage";
import AutopilotApprovalPage from "./pages/AutopilotApprovalPage";
import AutopilotRunsPage from "./pages/AutopilotRunsPage";
import AutopilotOutcomesPage from "./pages/AutopilotOutcomesPage";
import AutopilotFeedbackPage from "./pages/AutopilotFeedbackPage";
import AutopilotExperimentsPage from "./pages/AutopilotExperimentsPage";
import DraftLibraryPage from "./pages/DraftLibraryPage";
import SpecStatementsPage from "./pages/SpecStatementsPage";

// ✅ Settings page (new)
import SettingsPage from "./pages/SettingsPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";

// ✅ NEW: Create Quiz page (teacher only)
import CreateQuizPage from "./pages/CreateQuizPage";

// ✅ NEW: Quiz Stats page (teacher only)
import QuizStatsPage from "./pages/QuizStatsPage";

// ✅ NEW: Teacher flashcards editor page
import FlashcardsEditorPage from "./pages/FlashcardsEditorPage";
import TeacherFlashcardBankPage from "./pages/TeacherFlashcardBankPage";
import TeacherQuizBankPage from "./pages/TeacherQuizBankPage";
import TeacherPastPapersBankPage from "./pages/TeacherPastPapersBankPage";
import TeacherCoveragePage from "./pages/TeacherCoveragePage";
import TeacherQuestionBrowserPage from "./pages/TeacherQuestionBrowserPage";
import ExternalSourcesPage from "./pages/ExternalSourcesPage";

// ✅ NEW: Assessment pages - ALL in src/pages/
import AssessmentPaperStartPage from "./pages/AssessmentPaperStartPage";
import AssessmentPaperAttemptPage from "./pages/AssessmentPaperAttemptPage";
import AssessmentPaperResultsPage from "./pages/AssessmentPaperResultsPage";
import StudentAssessmentsPage from "./pages/StudentAssessmentsPage";
import AssessmentPapersList from "./pages/AssessmentPapersList"; // ✅ ADDED
import TeacherExamQuestionBankPage from "./pages/TeacherExamQuestionBankPage";
import AssessmentPaperEditPage from "./pages/AssessmentPaperEditPage";
import TeacherWorksheetBuilderPage from "./pages/TeacherWorksheetBuilderPage";
import StudentWorksheetPage from "./pages/StudentWorksheetPage";
import StudentQuizPage from "./pages/StudentQuizPage";
import TeacherWorksheetReportPage from "./pages/TeacherWorksheetReportPage";
import TeacherWorksheetAttemptPage from "./pages/TeacherWorksheetAttemptPage";
import TeacherNeedsMarkingPage from "./pages/TeacherNeedsMarkingPage";
import StudentMyWorkPage from "./pages/StudentMyWorkPage";
import StudentMyProgressPage from "./pages/StudentMyProgressPage";
import StudentWorksheetAttemptViewPage from "./pages/StudentWorksheetAttemptViewPage";
import StudentPracticePage from "./pages/StudentPracticePage";
import FlashcardSessionPage from "./pages/FlashcardSessionPage";
import QuizSessionPage from "./pages/QuizSessionPage";
import ExamPracticePage from "./pages/ExamPracticePage";
import QuickQuizPage from "./pages/QuickQuizPage";
import StructureNotesPage from "./pages/StructureNotesPage";
import TeacherTopicStatsPage from "./pages/TeacherTopicStatsPage";
import TeacherTopicPerformancePage from "./pages/TeacherTopicPerformancePage";
import TeacherLinkStudentsPage from "./pages/TeacherLinkStudentsPage";
import DocsViewerPage from "./pages/DocsViewerPage";
import CoverageDashboardPage from "./pages/CoverageDashboardPage";
import ContentIssuesPage from "./pages/ContentIssuesPage";
import CsvImportPage from "./pages/CsvImportPage";
import MonitoringVerificationPage from "./pages/MonitoringVerificationPage";

import "./App.css";

/* =========================
   Auth helpers (SYNC)
========================= */

type UserType = "student" | "teacher" | "parent" | "admin";

/* =========================
   ProtectedRoute (SYNC, NO STATE)
========================= */

interface ProtectedRouteProps {
  children: ReactNode;
  requireTeacher?: boolean;
  requireStudent?: boolean;
  requireAdmin?: boolean;
  requireParent?: boolean;

  // ✅ NEW: allows either teacher OR admin (needed for /edit-lesson/:id)
  requireTeacherOrAdmin?: boolean;

  // ✅ Admin OR content_manager (for lesson/taxonomy/content routes)
  requireAdminOrContentManager?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireTeacher = false,
  requireStudent = false,
  requireAdmin = false,
  requireParent = false,
  requireTeacherOrAdmin = false,
  requireAdminOrContentManager = false,
}) => {
  const { token, user, refresh } = useCurrentUser({ watchLocation: true });
  const auth = token && user ? { token, user } : null;

  if (!auth) {
    clearAuthStorage();
    refresh();
    return <Navigate to="/login" replace />;
  }

  const userType = user?.userType as UserType | undefined;
  const staffRole = (user as { staffRole?: string })?.staffRole;

  // If userType is missing/invalid, treat as logged out
  if (!userType || !["student", "teacher", "parent", "admin"].includes(userType)) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  // ✅ Combined gate (teacher OR admin)
  if (requireTeacherOrAdmin && userType !== "teacher" && userType !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ Admin OR content_manager (for content routes)
  if (requireAdminOrContentManager) {
    const isAdmin = userType === "admin";
    const isContentManager = staffRole === "content_manager";
    if (!isAdmin && !isContentManager) return <Navigate to="/dashboard" replace />;
    return <>{children}</>;
  }

  // Role gates
  if (requireTeacher && userType !== "teacher") return <Navigate to="/dashboard" replace />;
  if (requireStudent && userType !== "student") return <Navigate to="/dashboard" replace />;
  if (requireAdmin && userType !== "admin") return <Navigate to="/dashboard" replace />;
  if (requireParent && userType !== "parent") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

/* =========================
   Role-based redirect
========================= */

const RoleBasedRedirect: React.FC = () => {
  const { token, user, refresh } = useCurrentUser({ watchLocation: true });
  const auth = token && user ? { token, user } : null;

  if (!auth) {
    clearAuthStorage();
    refresh();
    return <Navigate to="/login" replace />;
  }

  const userType = user?.userType as UserType | undefined;

  if (userType === "teacher") return <Navigate to="/teacher-dashboard" replace />;
  if (userType === "student") return <Navigate to="/student-dashboard" replace />;
  if (userType === "parent") return <Navigate to="/parent-dashboard" replace />;
  if (userType === "admin") return <Navigate to="/admin" replace />;
  if ((user as { staffRole?: string })?.staffRole === "content_manager") return <Navigate to="/admin" replace />;

  return <Dashboard />;
};

/* =========================
   Hide Footer on editor/creation routes (immersive UX)
========================= */

const EDITOR_ROUTE_PATTERNS = [
  (path: string) => path === "/create-lesson",
  (path: string) => /^\/edit-lesson\/[^/]+$/.test(path),
  (path: string) => /^\/lessons\/[^/]+\/flashcards$/.test(path),
  (path: string) => /^\/assessments\/papers\/[^/]+\/edit$/.test(path),
];

function isEditorRoute(pathname: string): boolean {
  return EDITOR_ROUTE_PATTERNS.some((fn) => fn(pathname));
}

/* =========================
   App
========================= */

function App() {
  const { pathname } = useLocation();
  const showFooter = !isEditorRoute(pathname);

  return (
    <div className="App" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<HomePage />} />

          {/* Existing */}
          <Route path="/explore/subject" element={<SubjectOptionsPage />} />

          {/* Lesson demo */}
          <Route path="/lesson-demo" element={<LessonDemoPage />} />

          {/* Real browse lessons page (public for now) */}
          <Route path="/browse-lessons" element={<BrowseLessonsPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/complete-profile"
            element={
              <ProtectedRoute>
                <CompleteProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChangePage />} />
          <Route path="/admin-login" element={<AdminLoginPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <RoleBasedRedirect />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher-dashboard"
            element={
              <ProtectedRoute requireTeacher>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/topic-banks/flashcards"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherFlashcardBankPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/topic-banks/quizzes"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherQuizBankPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/topic-banks/past-papers"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherPastPapersBankPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/flashcards"
            element={<Navigate to="/teacher/topic-banks/flashcards" replace />}
          />
          <Route
            path="/teacher/content-coverage"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherCoveragePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/external-sources"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <ExternalSourcesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coverage"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <CoverageDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/questions"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherQuestionBrowserPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/content-issues"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <ContentIssuesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/create-lesson"
            element={
              <ProtectedRoute requireTeacher>
                <CreateLessonPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/create-quiz"
            element={
              <ProtectedRoute requireTeacher>
                <CreateQuizPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/quiz-stats"
            element={
              <ProtectedRoute requireTeacher>
                <QuizStatsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/analysis"
            element={
              <ProtectedRoute requireTeacher>
                <AnalysisPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/lesson/:id"
            element={
              <ProtectedRoute>
                <LessonViewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/lesson/:id"
            element={
              <ProtectedRoute requireStudent>
                <LessonViewPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ NEW: Teacher/Admin Flashcards Editor for a lesson */}
          <Route
            path="/lessons/:id/flashcards"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <FlashcardsEditorPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ LOCKED IN: teacher OR admin can open the editor */}
          <Route
            path="/edit-lesson/:id"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <EditLessonPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student-dashboard"
            element={
              <ProtectedRoute requireStudent>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/my-work"
            element={
              <ProtectedRoute requireStudent>
                <StudentMyWorkPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/my-progress"
            element={
              <ProtectedRoute requireStudent>
                <StudentMyProgressPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/practice"
            element={
              <ProtectedRoute requireStudent>
                <StudentPracticePage />
              </ProtectedRoute>
            }
          />

          {/* Actionable Revision Flow: topic-based practice sessions */}
          <Route
            path="/practice/flashcards/:topicKey"
            element={
              <ProtectedRoute requireStudent>
                <FlashcardSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practice/quiz/:topicKey"
            element={
              <ProtectedRoute requireStudent>
                <QuizSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practice/exam/:topicKey"
            element={
              <ProtectedRoute requireStudent>
                <ExamPracticePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/quick-quiz"
            element={
              <ProtectedRoute requireStudent>
                <QuickQuizPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/structure-notes"
            element={
              <ProtectedRoute requireStudent>
                <StructureNotesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/worksheet-attempts/:attemptId"
            element={
              <ProtectedRoute requireStudent>
                <StudentWorksheetAttemptViewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/progress"
            element={
              <ProtectedRoute requireStudent>
                <StudentProgressPage />
              </ProtectedRoute>
            }
          />

          {/* /lessons -> real browse page, student only */}
          <Route
            path="/lessons"
            element={
              <ProtectedRoute requireStudent>
                <Navigate to="/browse-lessons" replace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/lesson/:id"
            element={
              <ProtectedRoute requireTeacher>
                <EditLessonPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/classroom/:lessonId"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <ClassroomModePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/reports/biology-readiness"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <BiologyReadinessReportPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/reports/lesson/:id"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <LessonAttemptReportPage />
              </ProtectedRoute>
            }
          />

          {/* PR-PRACTICE-LOOP-1: Teacher topic performance stats */}
          <Route
            path="/topic-stats"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherTopicStatsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/reports/attempts"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherAttemptsSummaryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/reports/at-risk"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherAtRiskPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/reports/needs-attention"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherNeedsAttentionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/misconceptions"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherMisconceptionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/reteach-plans"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherReteachPlansPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/reports/topic-performance"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherTopicPerformancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/ops/link-students"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherLinkStudentsPage />
              </ProtectedRoute>
            }
          />

          <Route path="/docs/view" element={<DocsViewerPage />} />

          {/* Hidden monitoring verification — not linked from nav */}
          <Route path="/monitoring" element={<MonitoringVerificationPage />} />

          <Route
            path="/teacher/exam-question-bank"
            element={
              <ProtectedRoute requireTeacher>
                <TeacherExamQuestionBankPage />
              </ProtectedRoute>
            }
          />

          {/* PR-W6: Needs marking queue */}
          <Route
            path="/teacher/worksheets/needs-marking"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherNeedsMarkingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/worksheets/:id/edit"
            element={
              <ProtectedRoute requireTeacher>
                <TeacherWorksheetBuilderPage />
              </ProtectedRoute>
            }
          />

          {/* PR-W4: Public student worksheet by share link */}
          <Route path="/w/:shareId" element={<StudentWorksheetPage />} />

          {/* PR-EDGE-4.1: Public quiz/assessment by share link */}
          <Route path="/q/:shareId" element={<StudentQuizPage />} />

          {/* PR-W4: Teacher assignment report */}
          <Route
            path="/teacher/worksheet-assignments/:id/report"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherWorksheetReportPage />
              </ProtectedRoute>
            }
          />

          {/* PR-W4.2: Teacher single attempt view (read-only) */}
          <Route
            path="/teacher/worksheet-attempts/:attemptId"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <TeacherWorksheetAttemptPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payouts"
            element={
              <ProtectedRoute requireTeacher>
                <TeacherPayoutPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ Restored: Main assessments page */}
          <Route
            path="/assessments"
            element={
              <ProtectedRoute requireStudent>
                <StudentAssessmentsPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ ADDED: Assessment Papers List page - NOW FOR ALL AUTHENTICATED USERS */}
          <Route
            path="/assessments/papers"
            element={
              <ProtectedRoute>
                <AssessmentPapersList />
              </ProtectedRoute>
            }
          />

          {/* ✅ FIXED: Assessment paper routes - ALL using :id for consistency */}
          <Route
            path="/assessments/papers/:id/start"
            element={
              <ProtectedRoute requireStudent>
                <AssessmentPaperStartPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/assessments/papers/:id/attempt"
            element={
              <ProtectedRoute requireStudent>
                <AssessmentPaperAttemptPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ Assessment Results route - Using :id for consistency */}
          <Route
            path="/assessments/papers/:id/results"
            element={
              <ProtectedRoute requireStudent>
                <AssessmentPaperResultsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/assessments/papers/:id/edit"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <AssessmentPaperEditPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ optional: keep old path alive so old links don't break */}
          <Route
            path="/assessments/papers/builder"
            element={<Navigate to="/assessments/papers" replace />}
          />

          {/* ✅ Admin Dashboard (canonical) — admin or content_manager */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ FIX 404: Admin Dashboard alias route (matches /#/admin-dashboard) */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/metrics"
            element={
              <ProtectedRoute requireAdmin>
                <AdminMetricsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <ProtectedRoute requireAdmin>
                <AdminAuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ingest"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AdminIngestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/csv-import"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <CsvImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/csv-import"
            element={
              <ProtectedRoute requireTeacherOrAdmin>
                <CsvImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/lesson/:id"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AdminLessonViewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/content-issues"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <ContentIssuesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/question-banks"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AdminQuestionBanksPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/taxonomy"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AdminTaxonomyPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/content-coverage"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <ContentCoveragePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/launch-coverage"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AdminLaunchCoveragePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/topic/:specKey/:topicKey"
            element={
              <ProtectedRoute requireAdmin>
                <TopicCommandCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/autopilot-approval"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AutopilotApprovalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/autopilot-runs"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AutopilotRunsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/autopilot-outcomes"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AutopilotOutcomesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/autopilot-experiments"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AutopilotExperimentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/draft-library"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <DraftLibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/spec-statements"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <SpecStatementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/autopilot-feedback"
            element={
              <ProtectedRoute requireAdminOrContentManager>
                <AutopilotFeedbackPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/edit-profile"
            element={
              <ProtectedRoute>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute requireAdmin>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/subscription"
            element={
              <ProtectedRoute>
                <SubscriptionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/parent-dashboard"
            element={
              <ProtectedRoute requireParent>
                <ParentDashboard />
              </ProtectedRoute>
            }
          />

          {/* ✅ TEMPORARY TEST ROUTE */}
          <Route 
            path="/assessments-test" 
            element={
              <div style={{ padding: 40 }}>
                <h2>ASSESSMENTS ROUTE OK</h2>
                <p>If you can see this, routing is working!</p>
                <div style={{ marginTop: 20 }}>
                  <h3>Test Links:</h3>
                  <ul>
                    <li><a href="/assessments/papers/test123/start">/assessments/papers/test123/start</a></li>
                    <li><a href="/assessments/papers/test123/attempt">/assessments/papers/test123/attempt</a></li>
                    <li><a href="/assessments/papers/test123/results">/assessments/papers/test123/results</a></li>
                  </ul>
                </div>
              </div>
            } 
          />

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {showFooter && <Footer />}
    </div>
  );
}

export default App;