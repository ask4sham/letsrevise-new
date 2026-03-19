import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const getApiBase = () => {
  const b = (process.env.REACT_APP_API_BASE || "").trim();
  if (b) return b.replace(/\/+$/, "").replace(/\/api\/?$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:5000";
};

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token.trim()) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    const verify = async () => {
      try {
        const base = getApiBase();
        const url = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.ok) {
          setStatus("success");
          setMessage(data.msg || "Email verified. You can now sign in.");
        } else {
          setStatus("error");
          setMessage(data.msg || "Verification failed. The link may have expired.");
        }
      } catch {
        setStatus("error");
        setMessage("Could not connect to the server. Please try again.");
      }
    };

    verify();
  }, [token]);

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
          Email Verification
        </h1>

        {status === "loading" && (
          <p style={{ color: "#6b7280", marginBottom: 24 }}>Verifying your email...</p>
        )}

        {status === "success" && (
          <>
            <p style={{ color: "#059669", marginBottom: 24, fontWeight: 600 }}>
              ✓ {message}
            </p>
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
          </>
        )}

        {status === "error" && (
          <>
            <p style={{ color: "#dc2626", marginBottom: 24, fontWeight: 600 }}>
              {message}
            </p>
            <Link
              to="/login"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                background: "#6b7280",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
