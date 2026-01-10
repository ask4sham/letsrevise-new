// /frontend/src/pages/LoginPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

/**
 * ✅ Backend URL (Netlify/Render)
 * Support BOTH env var names so you don't break older setups:
 * - REACT_APP_API_URL   (your Netlify setting)
 * - REACT_APP_API_BASE  (older local/dev setting)
 */
const RAW_API_BASE =
  process.env.REACT_APP_API_URL ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:5000";

// Normalize to avoid double slashes
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

/**
 * ✅ Dev-only helpers (hide in production)
 * Set in /frontend/.env.production:
 * REACT_APP_SHOW_TEST_HELPERS=false
 *
 * For local dev, create /frontend/.env.development:
 * REACT_APP_SHOW_TEST_HELPERS=true
 */
const SHOW_TEST_HELPERS = String(process.env.REACT_APP_SHOW_TEST_HELPERS) === "true";

type Role = "student" | "teacher" | "parent" | "admin";

/**
 * ✅ Role colours (UI only)
 * Student = blue, Teacher = orange, Parent = teal, Admin = purple
 */
const ROLE_COLORS: Record<Role, { border: string; bgActive: string }> = {
  student: { border: "#0d6efd", bgActive: "#e7f1ff" },
  teacher: { border: "#fd7e14", bgActive: "#fff4e6" },
  parent: { border: "#17a2b8", bgActive: "#e6f7f9" },
  admin: { border: "#6f42c1", bgActive: "#f2e9ff" },
};

function useQueryRole(): Role | null {
  const { search } = useLocation();
  return useMemo(() => {
    const role = new URLSearchParams(search).get("role") as Role | null;
    if (!role) return null;
    return ["student", "teacher", "parent", "admin"].includes(role) ? role : null;
  }, [search]);
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const roleFromQuery = useQueryRole();

  const [activeRole, setActiveRole] = useState<Role>(roleFromQuery || "student");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("");

  // Show a clear "you're already logged in" state (prevents confusion)
  const [existingUserEmail, setExistingUserEmail] = useState<string | null>(null);

  // ✅ HASH-SAFE redirect (works with HashRouter + Netlify)
  const redirectAfterLogin = (userType?: string) => {
    const target =
      userType === "teacher"
        ? "/teacher-dashboard"
        : userType === "parent"
        ? "/parent-dashboard"
        : userType === "admin"
        ? "/admin-dashboard"
        : "/student-dashboard";

    navigate(target, { replace: true });
  };

  const checkBackend = async () => {
    try {
      await axios.get(`${API_BASE}/api/health`);
      setBackendStatus("✅ Backend connected");
    } catch {
      setBackendStatus("❌ Backend not connected");
    }
  };

  const syncExistingLoginState = () => {
    try {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      if (token && userStr) {
        const u = JSON.parse(userStr);
        setExistingUserEmail(u?.email || "someone");
      } else {
        setExistingUserEmail(null);
      }
    } catch {
      setExistingUserEmail(null);
    }
  };

  const hardLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("postLoginRedirect");
    setExistingUserEmail(null);
    setFormData({ email: "", password: "" });
    setError("");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    console.log("LoginPage API_BASE =", API_BASE);
    if (SHOW_TEST_HELPERS) checkBackend();
    syncExistingLoginState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (roleFromQuery) setActiveRole(roleFromQuery);
  }, [roleFromQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((p) => ({
      ...p,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, formData);

      const token =
        response.data?.token || response.data?.jwt || response.data?.accessToken;

      if (token) localStorage.setItem("token", token);
      if (response.data?.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      // Refresh "already logged in" banner state
      syncExistingLoginState();

      // Prefer backend userType; fallback to selected tab
      redirectAfterLogin(response.data?.user?.userType || activeRole);
    } catch (err: any) {
      console.error("Login error:", err);

      const backendMsg =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        (err?.response?.status === 401
          ? "Invalid email or password."
          : "Server error.");

      setError(backendMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleFill = (role: Role) => {
    setActiveRole(role);

    const credentials =
      role === "teacher"
        ? { email: "teacher@example.com", password: "Password123" }
        : role === "parent"
        ? { email: "parent@example.com", password: "Password123" }
        : role === "admin"
        ? { email: "admin@example.com", password: "Password123" }
        : { email: "student@example.com", password: "Password123" };

    setFormData(credentials);
    setError("");
  };

  const handleAutoLogin = async (role: Role) => {
    handleFill(role);
    setTimeout(() => {
      const fakeEvent = { preventDefault: () => {} } as any;
      void handleSubmit(fakeEvent);
    }, 0);
  };

  /**
   * ✅ UPDATED: colour-coded role tabs
   * - Inactive tabs: coloured border + coloured text
   * - Active tab: stronger coloured border + light coloured background
   */
  const tabStyle = (role: Role): React.CSSProperties => {
    const isActive = role === activeRole;
    const c = ROLE_COLORS[role];

    return {
      flex: 1,
      padding: "10px 12px",
      borderRadius: "8px",
      border: isActive ? `2px solid ${c.border}` : `1px solid ${c.border}`,
      background: isActive ? c.bgActive : "#fff",
      color: c.border,
      cursor: "pointer",
      fontWeight: isActive ? "bold" : "normal",
    };
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "40px",
            borderRadius: "15px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "500px",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "#333",
            }}
          >
            Login to Your Account
          </h2>

          {SHOW_TEST_HELPERS && backendStatus && (
            <div
              style={{
                textAlign: "center",
                marginBottom: "12px",
                padding: "8px",
                background: backendStatus.includes("✅") ? "#d4edda" : "#f8d7da",
                color: backendStatus.includes("✅") ? "#155724" : "#721c24",
                borderRadius: "5px",
                fontSize: "0.9rem",
              }}
            >
              {backendStatus}
            </div>
          )}

          {/* If token/user already exists, show it clearly + allow logout */}
          {existingUserEmail && (
            <div
              style={{
                background: "#fff3cd",
                color: "#856404",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "16px",
                border: "1px solid #ffeeba",
              }}
            >
              You’re already logged in as <b>{existingUserEmail}</b>.
              <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() =>
                    redirectAfterLogin(
                      JSON.parse(localStorage.getItem("user") || "{}")?.userType
                    )
                  }
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#0d6efd",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Go to dashboard
                </button>
                <button
                  type="button"
                  onClick={hardLogout}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Log out
                </button>
              </div>
            </div>
          )}

          {/* Role tabs: Student / Teacher / Parent / Admin */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "18px" }}>
            <button
              type="button"
              style={tabStyle("student")}
              onClick={() => setActiveRole("student")}
            >
              Student
            </button>
            <button
              type="button"
              style={tabStyle("teacher")}
              onClick={() => setActiveRole("teacher")}
            >
              Teacher
            </button>
            <button
              type="button"
              style={tabStyle("parent")}
              onClick={() => setActiveRole("parent")}
            >
              Parent
            </button>
            <button
              type="button"
              style={tabStyle("admin")}
              onClick={() => setActiveRole("admin")}
            >
              Admin
            </button>
          </div>

          {error && (
            <div
              style={{
                background: "#fee",
                color: "#c00",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                border: "1px solid #fcc",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: "30px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: loading ? "#999" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* Test helpers (DEV ONLY) */}
          {SHOW_TEST_HELPERS && (
            <>
              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleFill("student")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Fill Test Student
                </button>
                <button
                  type="button"
                  onClick={() => handleFill("teacher")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#fd7e14",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Fill Test Teacher
                </button>
              </div>

              <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleAutoLogin("student")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#20c997",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Auto Login Student
                </button>
                <button
                  type="button"
                  onClick={() => handleAutoLogin("teacher")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#e83e8c",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Auto Login Teacher
                </button>
              </div>

              <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleFill("parent")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#17a2b8",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Fill Test Parent
                </button>
                <button
                  type="button"
                  onClick={() => handleFill("admin")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "#6f42c1",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Fill Test Admin
                </button>
              </div>
            </>
          )}

          <div style={{ textAlign: "center", marginTop: "30px" }}>
            <p style={{ color: "#666" }}>
              Don&apos;t have an account?{" "}
              <Link to="/register" style={{ color: "#007bff", fontWeight: "bold" }}>
                Register here
              </Link>
            </p>

            {/* Test credentials text (DEV ONLY) */}
            {SHOW_TEST_HELPERS && (
              <p style={{ marginTop: "10px", fontSize: "0.8rem", color: "#888" }}>
                Test accounts: student@example.com / Password123 (Student) or teacher@example.com /
                Password123 (Teacher) or parent@example.com / Password123 (Parent) or admin@example.com /
                Password123 (Admin)
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
