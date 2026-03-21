// /frontend/src/pages/LoginPage.tsx
// PR-AUTH-UI-2: use useCurrentUser for existing-login state; call refresh() after setItem/removeItem.
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { setAuth, clearAuth } from "../utils/authStorage";

const MOBILE_BREAKPOINT = 768;

/**
 * ✅ Dev-only helpers (hide in production)
 * Set in /frontend/.env.production:
 * REACT_APP_SHOW_TEST_HELPERS=false
 *
 * For local dev, create /frontend/.env.development:
 * REACT_APP_SHOW_TEST_HELPERS=true
 */
const SHOW_TEST_HELPERS = String(process.env.REACT_APP_SHOW_TEST_HELPERS) === "true";

/** Public roles only — Admin is site-owner reserved, not shown in public UI */
type PublicRole = "student" | "teacher" | "parent";

const ROLE_COLORS: Record<PublicRole, { border: string; bgActive: string }> = {
  student: { border: "#0d6efd", bgActive: "#e7f1ff" },
  teacher: { border: "#fd7e14", bgActive: "#fff4e6" },
  parent: { border: "#17a2b8", bgActive: "#e6f7f9" },
};

function useQueryRole(): PublicRole | null {
  const { search } = useLocation();
  return useMemo(() => {
    const role = new URLSearchParams(search).get("role") as string | null;
    if (!role) return null;
    return ["student", "teacher", "parent"].includes(role) ? (role as PublicRole) : null;
  }, [search]);
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const roleFromQuery = useQueryRole();

  const [activeRole, setActiveRole] = useState<PublicRole>(roleFromQuery || "student");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [backendStatus, setBackendStatus] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Show a clear "you're already logged in" state (prevents confusion)
  const [existingUserEmail, setExistingUserEmail] = useState<string | null>(null);
  const { user: currentUser, refresh } = useCurrentUser({ watchLocation: true });

  useEffect(() => {
    setExistingUserEmail(currentUser?.email ?? null);
  }, [currentUser?.email]);

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
      // ✅ Use the same api instance as the rest of the app
      await api.get("/health");
      setBackendStatus("✅ Backend connected");
    } catch {
      setBackendStatus("❌ Backend not connected");
    }
  };

  const hardLogout = () => {
    clearAuth();
    setExistingUserEmail(null);
    setFormData({ email: "", password: "" });
    setError("");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    // Helpful debug: shows the axios baseURL from the shared api instance
    // eslint-disable-next-line no-console
    console.log("LoginPage api.baseURL =", (api as any)?.defaults?.baseURL);
    if (SHOW_TEST_HELPERS) checkBackend();
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
      // ✅ Use shared api instance so host/baseURL is consistent everywhere
      const response = await api.post("/auth/login", formData);

      const token =
        (response as any)?.data?.token ||
        (response as any)?.data?.jwt ||
        (response as any)?.data?.accessToken;
      const userData = (response as any)?.data?.user;
      if (token && userData) {
        setAuth(token, userData);
      }
      refresh();

      // Prefer backend userType; fallback to selected tab
      redirectAfterLogin((response as any)?.data?.user?.userType || activeRole);
    } catch (err: any) {
      console.error("Login error:", err);

      // Works with both:
      // - axios-style errors (err.response?.data?.msg)
      // - our api interceptor rejections ({ message, status, data })
      const backendMsg =
        err?.data?.msg ||
        err?.data?.message ||
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        (err?.status === 401 || err?.response?.status === 401
          ? "Invalid email or password."
          : err?.message || "Server error.");

      setError(backendMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleFill = (role: PublicRole) => {
    setActiveRole(role);

    const credentials =
      role === "teacher"
        ? { email: "teacher@example.com", password: "Password123" }
        : role === "parent"
        ? { email: "parent@example.com", password: "Password123" }
        : { email: "student@example.com", password: "Password123" };

    setFormData(credentials);
    setError("");
  };

  const handleAutoLogin = async (role: PublicRole) => {
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
  const tabStyle = (role: PublicRole): React.CSSProperties => {
    const isActive = role === activeRole;
    const c = ROLE_COLORS[role];

    return {
      flex: isMobile ? "1 1 45%" : 1,
      minWidth: isMobile ? undefined : 0,
      padding: "12px 14px",
      minHeight: 44,
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
              <div style={{ marginTop: "10px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => redirectAfterLogin(currentUser?.userType)}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "12px 16px",
                    minHeight: 44,
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
                    minWidth: 120,
                    padding: "12px 16px",
                    minHeight: 44,
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

          {/* Role tabs: Student / Teacher / Parent (Admin reserved, not public) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "18px" }}>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label
                  style={{
                    fontWeight: "bold",
                    color: "#333",
                  }}
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  style={{
                    fontSize: "0.9rem",
                    color: "#2563eb",
                    textDecoration: "none",
                  }}
                >
                  Forgot password?
                </Link>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "12px 44px 12px 12px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 44,
                    minWidth: 44,
                    height: 44,
                    minHeight: 44,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: "1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  👁
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 16px",
                minHeight: 44,
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
                  marginTop: "15px",
                }}
              >
                Fill Test Parent
              </button>
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
                Password123 (Teacher) or parent@example.com / Password123 (Parent)
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
