import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { readAuth, updateUser } from "../utils/authStorage";

type PageStatus =
  | "loading"
  | "success"
  | "expired"
  | "invalid"
  | "already_verified"
  | "no_token";

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<PageStatus>("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [resendMsg, setResendMsg] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const cooldownActive = Date.now() < cooldownUntil;
  const waitSec = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  useEffect(() => {
    if (!token.trim()) {
      setStatus("no_token");
      setMessage("No verification token provided.");
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = res?.data ?? {};
        const code = (data.code as string) || "";

        if (data.ok && (code === "success" || code === "")) {
          setStatus("success");
          setMessage(data.msg || "Your email has been verified.");
          try {
            const { token: t } = readAuth();
            if (t) {
              const me = await api.get("/users/me");
              const u = me?.data as Record<string, unknown> | undefined;
              if (u && typeof u === "object") {
                updateUser({
                  ...u,
                  id: String((u._id as { toString?: () => string })?.toString?.() ?? u.id ?? ""),
                  emailVerified: true,
                  verificationStatus: "verified",
                });
              }
            }
          } catch {
            // optional: user may not be logged in on this device
          }
          return;
        }

        if (data.ok && code === "already_verified") {
          setStatus("already_verified");
          setMessage(data.msg || "Your email is already verified.");
          return;
        }

        if (code === "expired") {
          setStatus("expired");
          setMessage(data.msg || "This verification link has expired.");
          return;
        }

        if (code === "invalid" || !data.ok) {
          setStatus("invalid");
          setMessage(data.msg || "This verification link is invalid.");
          return;
        }

        setStatus("invalid");
        setMessage(data.msg || "Verification could not be completed.");
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { code?: string; msg?: string } }; data?: { code?: string; msg?: string } };
        const data = ax?.response?.data ?? ax?.data ?? {};
        const code = data.code;

        if (code === "expired") {
          setStatus("expired");
          setMessage(data.msg || "This verification link has expired.");
        } else if (code === "invalid") {
          setStatus("invalid");
          setMessage(data.msg || "This verification link is invalid.");
        } else {
          setStatus("invalid");
          const msg =
            data.msg ||
            (err as Error)?.message ||
            "Could not connect to the server. Please try again.";
          setMessage(msg);
        }
      }
    };

    void verify();
  }, [token]);

  const handleResend = async () => {
    const em = resendEmail.trim();
    if (!em || resendStatus === "loading" || cooldownActive) return;
    setResendStatus("loading");
    setResendMsg("");
    try {
      const res = await api.post("/auth/resend-verification", { email: em });
      const data = res?.data ?? {};
      setResendStatus("sent");
      setResendMsg(data.msg || "A new verification email has been sent.");
      setCooldownUntil(Date.now() + 45 * 1000);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { msg?: string; retryAfterSeconds?: number }; status?: number } };
      if (ax?.response?.status === 429 && ax.response.data?.retryAfterSeconds != null) {
        const s = Number(ax.response.data.retryAfterSeconds);
        setCooldownUntil(Date.now() + (Number.isFinite(s) ? s : 45) * 1000);
        setResendMsg(ax.response.data.msg || "Please wait before resending.");
      } else {
        setResendStatus("error");
        setResendMsg(ax?.response?.data?.msg || "Failed to send. Please try again.");
      }
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
          textAlign: "center",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 16, color: "#111827" }}>Email verification</h1>

        {status === "loading" && (
          <p style={{ color: "#6b7280", marginBottom: 24 }}>Verifying your email...</p>
        )}

        {status === "success" && (
          <>
            <p style={{ color: "#059669", marginBottom: 24, fontWeight: 600 }}>{message}</p>
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

        {status === "already_verified" && (
          <>
            <p style={{ color: "#059669", marginBottom: 24, fontWeight: 600 }}>{message}</p>
            <Link
              to="/dashboard"
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
              Continue
            </Link>
          </>
        )}

        {(status === "expired" || status === "invalid" || status === "no_token") && (
          <>
            <p style={{ color: status === "no_token" ? "#6b7280" : "#dc2626", marginBottom: 16, fontWeight: 600 }}>
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
                    disabled={resendStatus === "loading" || !resendEmail.trim() || cooldownActive}
                    onClick={() => void handleResend()}
                    style={{
                      padding: "10px 12px",
                      background: cooldownActive ? "#9ca3af" : "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor:
                        resendStatus === "loading" || cooldownActive ? "not-allowed" : "pointer",
                    }}
                  >
                    {resendStatus === "loading" ? "Sending..." : cooldownActive ? `Wait ${waitSec}s` : "Resend"}
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
