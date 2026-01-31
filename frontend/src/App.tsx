// /frontend/src/App.tsx
import React, { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
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

// ✅ Settings page (new)
import SettingsPage from "./pages/SettingsPage";

// ✅ NEW: Create Quiz page (teacher only)
import CreateQuizPage from "./pages/CreateQuizPage";

// ✅ NEW: Quiz Stats page (teacher only)
import QuizStatsPage from "./pages/QuizStatsPage";

// ✅ NEW: Teacher flashcards editor page
import FlashcardsEditorPage from "./pages/FlashcardsEditorPage";

// ✅ NEW: Assessment pages - ALL in src/pages/
import AssessmentPaperStartPage from "./pages/AssessmentPaperStartPage";
import AssessmentPaperAttemptPage from "./pages/AssessmentPaperAttemptPage";
import AssessmentPaperResultsPage from "./pages/AssessmentPaperResultsPage";
import StudentAssessmentsPage from "./pages/StudentAssessmentsPage";
import AssessmentPapersList from "./pages/AssessmentPapersList"; // ✅ ADDED

import "./App.css";

/* =========================
   Auth helpers (SYNC)
========================= */

type UserType = "student" | "teacher" | "parent" | "admin";

function readAuthFromStorage(): { token: string; user: any } | null {
  try {
    if (typeof window === "undefined") return null;

    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (!token || !userStr) return null;

    const user = JSON.parse(userStr);
    if (!user || typeof user !== "object") return null;

    return { token, user };
  } catch (e) {
    console.error("Failed to read auth from localStorage:", e);
    return null;
  }
}

function clearAuthStorage() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("postLoginRedirect");
  } catch {
    // ignore
  }
}

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
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireTeacher = false,
  requireStudent = false,
  requireAdmin = false,
  requireParent = false,
  requireTeacherOrAdmin = false,
}) => {
  const auth = readAuthFromStorage();

  if (!auth) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  const userType: UserType | undefined = auth.user?.userType;

  // If userType is missing/invalid, treat as logged out
  if (!userType || !["student", "teacher", "parent", "admin"].includes(userType)) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  // ✅ Combined gate (teacher OR admin)
  if (requireTeacherOrAdmin && userType !== "teacher" && userType !== "admin") {
    return <Navigate to="/dashboard" replace />;
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
  const auth = readAuthFromStorage();

  // This route is already protected, but keep it safe
  if (!auth) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  const userType: UserType | undefined = auth.user?.userType;

  if (userType === "teacher") return <Navigate to="/teacher-dashboard" replace />;
  if (userType === "student") return <Navigate to="/student-dashboard" replace />;
  if (userType === "parent") return <Navigate to="/parent-dashboard" replace />;
  if (userType === "admin") return <Navigate to="/admin" replace />;

  return <Dashboard />;
};

/* =========================
   App
========================= */

function App() {
  return (
    <div className="App" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1 }}>
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

          {/* ✅ optional: keep old path alive so old links don't break */}
          <Route
            path="/assessments/papers/builder"
            element={<Navigate to="/assessments/papers" replace />}
          />

          {/* ✅ Admin Dashboard (canonical) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ FIX 404: Admin Dashboard alias route (matches /#/admin-dashboard) */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/lesson/:id"
            element={
              <ProtectedRoute requireAdmin>
                <AdminLessonViewPage />
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
      <Footer />
    </div>
  );
}

export default App;