// /frontend/src/pages/LoginPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

// ✅ Backend URL (Netlify uses env var)
const RAW_API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:5000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

type Role = "student" | "teacher" | "parent" | "admin";

function useQueryRole(): Role | null {
  const { search } = useLocation();
  return useMemo(() => {
    const role = new URLSearchParams(search).get("role") as Role | null;
    if (!role) return null;
    return ["student", "teacher", "parent", "admin"].includes(role)
      ? role
      : null;
  }, [search]);
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const roleFromQuery = useQueryRole();

  const [activeRole, setActiveRole] = useState<Role>(
    roleFromQuery || "student"
  );

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("");

  // ✅ HASH-SAFE redirect (CRITICAL FIX)
  const redirectAfterLogin = (userType?: string) => {
    if (userType === "teacher") {
      navigate("/teacher-dashboard", { replace: true });
    } else if (userType === "parent") {
      navigate("/parent-dashboard", { replace: true });
    } else if (userType === "admin") {
      navigate("/admin-dashboard", { replace: true });
    } else {
      navigate("/student-dashboard", { replace: true });
    }
  };

  useEffect(() => {
    checkBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (roleFromQuery) setActiveRole(roleFromQuery);
  }, [roleFromQuery]);

  const checkBackend = async () => {
    try {
      await axios.get(`${API_BASE}/api/health`);
      setBackendStatus("✅ Backend connected");
    } catch {
      setBackendStatus("❌ Backend not connected");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE}/api/auth/login`,
        formData
      );

      const token = response.data?.token;
      if (token) localStorage.setItem("token", token);

      if (response.data?.user) {
        localStorage.setItem(
          "user",
          JSON.stringify(response.data.user)
        );
      }

      redirectAfterLogin(
        response.data.user?.userType || activeRole
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.msg ||
        err?.response?.data?.message ||
        "Login failed";

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFill = (role: Role) => {
    setActiveRole(role);

    const creds =
      role === "teacher"
        ? { email: "teacher@example.com", password: "Password123" }
        : role === "parent"
        ? { email: "parent@example.com", password: "Password123" }
        : role === "admin"
        ? { email: "admin@example.com", password: "Password123" }
        : { email: "student@example.com", password: "Password123" };

    setFormData(creds);
    setError("");
  };

  const handleAutoLogin = (role: Role) => {
    handleFill(role);
    setTimeout(() => {
      handleSubmit({ preventDefault() {} } as any);
    }, 0);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: 420 }}>
          <h2>Login to Your Account</h2>

          {backendStatus && <p>{backendStatus}</p>}

          {error && (
            <div style={{ color: "red", marginBottom: 10 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <input
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email"
              required
            />
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              required
            />
            <button disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </button>
          </form>

          <div style={{ marginTop: 10 }}>
            <button onClick={() => handleAutoLogin("student")}>
              Auto Login Student
            </button>
            <button onClick={() => handleAutoLogin("teacher")}>
              Auto Login Teacher
            </button>
          </div>

          <p>
            Don’t have an account?{" "}
            <Link to="/register">Register here</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
