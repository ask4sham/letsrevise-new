// Admin-only login — not linked from public UI. For site owners.
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { setAuth, clearAuth } from "../utils/authStorage";

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", formData);
      const data = res?.data ?? {};
      const user = data?.user;
      const userType = (user?.userType || "").toString().toLowerCase();

      if (userType !== "admin") {
        clearAuth();
        setError("Admin access only. Use the main login page for student, teacher, or parent accounts.");
        setLoading(false);
        return;
      }

      setAuth(data.token, user);
      navigate("/admin", { replace: true });
      window.location.reload();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { msg?: string; error?: string }; status?: number } };
      const msg =
        ax?.response?.data?.msg ||
        ax?.response?.data?.error ||
        "Invalid credentials";
      if (ax?.response?.status === 403) {
        clearAuth();
        setError(msg);
      } else {
        setError(msg || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
      }}
    >
      <div
        style={{
          background: "white",
          padding: 40,
          borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          maxWidth: 400,
          width: "100%",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8, color: "#111827", fontSize: "1.5rem" }}>
          Admin sign in
        </h1>
        <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
          Site owner access only.
        </p>

        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 20,
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #d1d5db", borderRadius: 8, marginBottom: 16, boxSizing: "border-box" }}
          />
          <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>
            Password
          </label>
          <div style={{ position: "relative", marginBottom: 24 }}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              style={{ width: "100%", padding: "12px 44px 12px 14px", border: "1px solid #d1d5db", borderRadius: 8, boxSizing: "border-box" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 24px",
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "#6b7280" }}>
          <a href="/#/login" style={{ color: "#4f46e5" }}>Back to main login</a>
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
