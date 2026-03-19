import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (!token.trim()) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = res?.data ?? {};

        if (data.ok) {
          setStatus("success");
          setMessage(data.msg || "Email verified. You can now sign in.");
        } else {
          setStatus("error");
          setMessage(data.msg || "Verification failed. The link may have expired.");
        }
      } catch (err: any) {
        setStatus("error");
        const msg = err?.data?.msg || err?.response?.data?.msg || err?.message;
        setMessage(msg || "Could not connect to the server. Please try again.");
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
            {resendStatus === "sent" ? (
              <p style={{ color: "#059669", marginBottom: 16 }}>{resendMsg}</p>
            ) : (
              <div style={{ marginBottom: 24, textAlign: "left" }}>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14, color: "#374151" }}>
                  Request a new verification link
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="email"
                    placeholder="Your email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      padding: "10px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    disabled={resendStatus === "loading" || !resendEmail.trim()}
                    onClick={async () => {
                      setResendStatus("loading");
                      setResendMsg("");
                      try {
                        const res = await api.post("/auth/resend-verification", { email: resendEmail.trim() });
                        const data = res?.data ?? {};
                        setResendStatus("sent");
                        setResendMsg(data.msg || "A new verification email has been sent.");
                      } catch (e: any) {
                        setResendStatus("error");
                        setResendMsg(e?.data?.msg || e?.message || "Failed to send. Please try again.");
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: resendStatus === "loading" ? "not-allowed" : "pointer",
                    }}
                  >
                    {resendStatus === "loading" ? "Sending..." : "Resend"}
                  </button>
                </div>
                {resendStatus === "error" && (
                  <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{resendMsg}</p>
                )}
              </div>
            )}
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
