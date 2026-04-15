import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { isEmailVerified } from "../../utils/emailVerification";
import { updateUser } from "../../utils/authStorage";
import { getErrorMessageFromData } from "../../utils/apiErrorMessage";

const COOLDOWN_SEC = 45;

function mergeMeIntoStoredUser(data: Record<string, unknown>) {
  const id = String(
    (data._id as { toString?: () => string })?.toString?.() ?? data.id ?? ""
  );
  return {
    ...data,
    id: id || data.id,
    verificationStatus: data.verificationStatus,
    emailVerified:
      typeof data.emailVerified === "boolean"
        ? data.emailVerified
        : String(data.verificationStatus || "").toLowerCase() === "verified",
  };
}

const EmailVerificationBanner: React.FC = () => {
  const { user, token, isLoggedIn, refresh } = useCurrentUser({ watchLocation: true });
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const show = isLoggedIn && token && user && !isEmailVerified(user);
  const email = (user?.email || "").trim();

  useEffect(() => {
    if (!show) setResendMsg(null);
  }, [show]);

  if (!show) return null;

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
      const ax = e as { response?: { data?: Record<string, unknown>; status?: number } };
      const data = ax?.response?.data;
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

  const handleRefreshStatus = async () => {
    if (!token || refreshing) return;
    setRefreshing(true);
    setResendMsg(null);
    try {
      const res = await api.get("/users/me");
      const data = res?.data as Record<string, unknown> | undefined;
      if (data && typeof data === "object") {
        updateUser(mergeMeIntoStoredUser(data));
        refresh();
      }
    } catch {
      setResendMsg("Could not refresh status. Try again.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      role="status"
      style={{
        margin: 0,
        padding: "10px 16px",
        background: "linear-gradient(90deg, #eef2ff 0%, #e0f2fe 100%)",
        borderBottom: "1px solid #c7d2fe",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: "10px 16px",
        fontSize: "0.9rem",
        color: "#1e293b",
      }}
    >
      <span style={{ fontWeight: 600 }}>Your email is not verified yet.</span>
      <span style={{ color: "#475569" }}>Check your inbox for the verification link.</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={resendLoading || !email || cooldownActive}
          onClick={() => void handleResend()}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: cooldownActive ? "#94a3b8" : "#2563eb",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: cooldownActive || resendLoading ? "not-allowed" : "pointer",
          }}
        >
          {resendLoading ? "Sending…" : cooldownActive ? `Resend (${waitSec}s)` : "Resend email"}
        </button>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void handleRefreshStatus()}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #64748b",
            background: "#fff",
            color: "#334155",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: refreshing ? "wait" : "pointer",
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh status"}
        </button>
      </div>
      {resendMsg && (
        <span style={{ width: "100%", textAlign: "center", fontSize: "0.85rem", color: "#047857" }}>
          {resendMsg}
        </span>
      )}
    </div>
  );
};

export default EmailVerificationBanner;
