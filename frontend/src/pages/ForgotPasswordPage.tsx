import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await api.post("/auth/forgot-password", { email: email.trim() });
      const data = res?.data ?? {};
      setStatus("success");
      setMessage(data.msg || "If an account exists with that email, you will receive a password reset link shortly.");
    } catch (err: unknown) {
      setStatus("error");
      const axErr = err as { response?: { data?: { msg?: string } }; message?: string };
      setMessage(axErr?.response?.data?.msg || axErr?.message || "Something went wrong. Please try again.");
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
          Forgot password
        </h1>
        <p style={{ color: "#6b7280", marginBottom: 24, fontSize: 14 }}>
          Enter your email and we&apos;ll send you a link to reset your password.
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
              htmlFor="email"
              style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "#374151" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
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
              {status === "loading" ? "Sending..." : "Send reset link"}
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

export default ForgotPasswordPage;
