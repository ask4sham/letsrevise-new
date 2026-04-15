import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { isEmailVerified } from "../../utils/emailVerification";
import { getErrorMessageFromData } from "../../utils/apiErrorMessage";

type Props = {
  /** Shown when the user is logged in but email is not verified */
  children: React.ReactNode;
};

const COOLDOWN_SEC = 45;

/**
 * Blocks premium/sensitive UI until the account email is verified.
 */
const VerificationGate: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const { user, token } = useCurrentUser({ watchLocation: true });
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  if (!token || !user || isEmailVerified(user)) {
    return <>{children}</>;
  }

  const email = (user.email || "").trim();
  const cooldownActive = Date.now() < cooldownUntil;
  const waitSec = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  const handleResend = async () => {
    if (!email || resendLoading || cooldownActive) return;
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await api.post("/auth/resend-verification", { email });
      const data = res?.data ?? {};
      if (data.ok !== false) {
        setResendMsg("A new verification email has been sent.");
        setCooldownUntil(Date.now() + COOLDOWN_SEC * 1000);
      } else {
        setResendMsg(getErrorMessageFromData(data, "Could not send email."));
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: unknown; status?: number } };
      const data = ax?.response?.data as Record<string, unknown> | undefined;
      if (ax?.response?.status === 429 && data?.retryAfterSeconds != null) {
        const s = Number(data.retryAfterSeconds);
        setCooldownUntil(Date.now() + (Number.isFinite(s) ? s : COOLDOWN_SEC) * 1000);
        setResendMsg(String(data.msg || "Please wait before resending."));
      } else {
        setResendMsg(getErrorMessageFromData(data, "Could not send email."));
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "48px auto",
        padding: "32px",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginTop: 0, color: "#111827", fontSize: "1.35rem" }}>Verify your email</h1>
      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
        Verify your email to use this feature.
      </p>
      {resendMsg && (
        <p style={{ color: resendMsg.includes("sent") ? "#059669" : "#b45309", fontSize: 14 }}>{resendMsg}</p>
      )}
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
        <button
          type="button"
          disabled={resendLoading || !email || cooldownActive}
          onClick={() => void handleResend()}
          style={{
            padding: "12px 20px",
            background: cooldownActive ? "#9ca3af" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: cooldownActive || resendLoading ? "not-allowed" : "pointer",
          }}
        >
          {resendLoading ? "Sending…" : cooldownActive ? `Resend email (${waitSec}s)` : "Resend email"}
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            padding: "12px 20px",
            background: "#f3f4f6",
            color: "#374151",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Go back
        </button>
      </div>
      <p style={{ marginTop: 24, fontSize: 13, color: "#9ca3af" }}>Signed in as {email || "—"}</p>
    </div>
  );
};

export default VerificationGate;
