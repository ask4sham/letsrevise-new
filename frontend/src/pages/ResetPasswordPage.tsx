import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatus("error");
      setMessage("Reset link is invalid or missing. Please request a new one.");
      return;
    }
    if (password.length < 6) {
      setStatus("error");
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await api.post("/auth/reset-password", {
        token: token.trim(),
        password,
      });
      const data = res?.data ?? {};
      setStatus("success");
      setMessage(data.msg || "Password reset successfully. You can now sign in.");
    } catch (err: unknown) {
      setStatus("error");
      const axErr = err as { response?: { data?: { msg?: string }; status?: number } };
      setMessage(
        axErr?.response?.data?.msg || "Reset failed. The link may have expired. Please request a new one."
      );
    }
  };

  if (!token.trim()) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        }}
      >
        <div
          style={{
            background: "white",
            padding: 40,
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 16, color: "#111827" }}>
            Invalid reset link
          </h1>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>
            This reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      }}
    >
      <div
        style={{
          background: "white",
          padding: 40,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          maxWidth: 440,
          width: "100%",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8, color: "#111827" }}>
          Reset password
        </h1>
        <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
          Enter your new password. It must be at least 6 characters.
        </p>

        {status === "success" && (
          <div
            style={{
              padding: 16,
              background: "#d1fae5",
              color: "#065f46",
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            {message}
            <div style={{ marginTop: 20 }}>
              <Link
                to="/login"
                style={{
                  display: "inline-block",
                  padding: "12px 24px",
                  background: "#2563eb",
                  color: "white",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Sign in
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div
            style={{
              padding: 16,
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            {message}
          </div>
        )}

        {status !== "success" && (
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="password"
              style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "#374151" }}
            >
              New password
            </label>
            <div style={{ position: "relative", marginBottom: 20 }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                disabled={status === "loading"}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  paddingRight: 48,
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 16,
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#6b7280",
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <label
              htmlFor="confirmPassword"
              style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "#374151" }}
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              minLength={6}
              disabled={status === "loading"}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 16,
                marginBottom: 20,
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                width: "100%",
                padding: "12px 24px",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: status === "loading" ? "not-allowed" : "pointer",
              }}
            >
              {status === "loading" ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Link
            to="/login"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
