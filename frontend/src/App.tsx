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

// ✅ Admin “View” profile route page
import ProfilePage from "./pages/ProfilePage";

// ✅ My Profile page (current user)
import UserProfilePage from "./pages/UserProfilePage";

// ✅ Edit My Profile page
import EditProfilePage from "./pages/EditProfilePage";

// ✅ Admin “View Lesson” route page (for /admin/lesson/:id)
import AdminLessonViewPage from "./pages/AdminLessonViewPage";

// ✅ Settings page (new)
import SettingsPage from "./pages/SettingsPage";

// ✅ NEW: Create Quiz page (teacher only)
import CreateQuizPage from "./pages/CreateQuizPage";

// ✅ NEW: Quiz Stats page (teacher only)
import QuizStatsPage from "./pages/QuizStatsPage";

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
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireTeacher = false,
  requireStudent = false,
  requireAdmin = false,
  requireParent = false,
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

          <Route
            path="/edit-lesson/:id"
            element={
              <ProtectedRoute requireTeacher>
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

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
