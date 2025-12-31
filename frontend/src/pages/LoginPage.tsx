import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

// ✅ Render backend URL
const API_BASE = "https://letsrevise-new.onrender.com";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("");

  // Decide where to send the user based on their type
  const redirectAfterLogin = (userType?: string) => {
    console.log("Redirecting, userType:", userType);

    if (userType === "teacher") {
      // Full teacher dashboard
      window.location.href = "/teacher-dashboard";
    } else if (userType === "admin") {
      // Admin dashboard (if you have this route)
      window.location.href = "/admin-dashboard";
    } else {
      // Default = student
      window.location.href = "/student-dashboard";
    }
  };

  useEffect(() => {
    checkBackend();
  }, []);

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
      console.log("Attempting login with:", formData);

      const response = await axios.post(`${API_BASE}/api/auth/login`, formData);

      console.log("Login success:", response.data);
      console.log("User type in response:", response.data.user?.userType);

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      redirectAfterLogin(response.data.user?.userType);
    } catch (err: any) {
      console.error("Login error:", err);
      let msg = "Login failed. ";

      if (!err.response) {
        msg += "Cannot connect to backend.";
      } else if (err.response.status === 401) {
        msg += "Invalid email or password.";
      } else {
        msg += err.response?.data?.message || "Server error.";
      }

      setError(msg);
      setLoading(false);
    }
  };

  const handleTestStudent = () => {
    setFormData({
      email: "student@example.com",
      password: "Password123",
    });
    setError("");
  };

  const handleTestTeacher = () => {
    setFormData({
      email: "teacher@example.com",
      password: "Password123",
    });
    setError("");
  };

  const handleAutoLogin = async (type: "student" | "teacher" | "admin") => {
    const credentials =
      type === "teacher"
        ? { email: "teacher@example.com", password: "Password123" }
        : type === "admin"
        ? { email: "admin@example.com", password: "Password123" }
        : { email: "student@example.com", password: "Password123" };

    setFormData(credentials);
    setError("");
    setLoading(true);

    try {
      console.log("Attempting auto-login:", credentials);
      const response = await axios.post(
        `${API_BASE}/api/auth/login`,
        credentials
      );

      console.log("Auto-login success:", response.data);
      console.log("Auto-login user type:", response.data.user?.userType);

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      redirectAfterLogin(response.data.user?.userType);
    } catch (err) {
      console.error("Auto-login error:", err);
      setError("Auto-login failed. Please try manually.");
      setLoading(false);
    }
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

          {backendStatus && (
            <div
              style={{
                textAlign: "center",
                marginBottom: "20px",
                padding: "8px",
                background: backendStatus.includes("✅")
                  ? "#d4edda"
                  : "#f8d7da",
                color: backendStatus.includes("✅") ? "#155724" : "#721c24",
                borderRadius: "5px",
                fontSize: "0.9rem",
              }}
            >
              {backendStatus}
            </div>
          )}

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

          <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
            <button
              onClick={handleTestStudent}
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
              onClick={handleTestTeacher}
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

          <div style={{ textAlign: "center", marginTop: "30px" }}>
            <p style={{ color: "#666" }}>
              Don't have an account?{" "}
              <Link
                to="/register"
                style={{ color: "#007bff", fontWeight: "bold" }}
              >
                Register here
              </Link>
            </p>
            <p
              style={{
                marginTop: "10px",
                fontSize: "0.8rem",
                color: "#888",
              }}
            >
              Test accounts: student@example.com / Password123 (Student) or
              teacher@example.com / Password123 (Teacher)
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
