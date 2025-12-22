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
   ProtectedRoute (SYNC, NO STATE)
========================= */

interface ProtectedRouteProps {
  children: ReactNode;
  requireTeacher?: boolean;
  requireStudent?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireTeacher = false,
  requireStudent = false,
  requireAdmin = false,
}) => {
  // Read auth info synchronously every time
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const userStr =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;

  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  let user: any;
  try {
    user = JSON.parse(userStr);
  } catch (e) {
    console.error("Failed to parse user from localStorage:", e);
    return <Navigate to="/login" replace />;
  }

  if (requireTeacher && user.userType !== "teacher") {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireStudent && user.userType !== "student") {
    return <Navigate to="/dashboard" replace />;
  }
  if (requireAdmin && user.userType !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/* =========================
   Role-based redirect
========================= */

const RoleBasedRedirect: React.FC = () => {
  const userStr =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;

  if (!userStr) {
    return <Dashboard />;
  }

  let user: any;
  try {
    user = JSON.parse(userStr);
  } catch (e) {
    console.error("Failed to parse user for RoleBasedRedirect:", e);
    return <Dashboard />;
  }

  if (user.userType === "teacher")
    return <Navigate to="/teacher-dashboard" replace />;
  if (user.userType === "student")
    return <Navigate to="/student-dashboard" replace />;
  if (user.userType === "admin") return <Navigate to="/admin" replace />;

  return <Dashboard />;
};

/* =========================
   App
========================= */

function App() {
  return (
    <div
      className="App"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
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

          {/* ✅ Create Quiz route (teacher only) */}
          <Route
            path="/create-quiz"
            element={
              <ProtectedRoute requireTeacher>
                <CreateQuizPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ Quiz Stats route (teacher only) */}
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

          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Admin lesson view route */}
          <Route
            path="/admin/lesson/:id"
            element={
              <ProtectedRoute requireAdmin>
                <AdminLessonViewPage />
              </ProtectedRoute>
            }
          />

          {/* My Profile (current user) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <UserProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Edit My Profile */}
          <Route
            path="/edit-profile"
            element={
              <ProtectedRoute>
                <EditProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Admin profile view */}
          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute requireAdmin>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Settings route (current user) */}
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

          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
