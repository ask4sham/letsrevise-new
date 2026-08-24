import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { updateUser } from "../utils/authStorage";
import { apiUrl } from "../utils/apiBaseUrl";

export const SUBSCRIPTION_SUCCESS_POLL_INTERVAL_MS = 2000;
export const SUBSCRIPTION_SUCCESS_MAX_POLL_ATTEMPTS = 30;
export const SUBSCRIPTION_SUCCESS_MAX_POLL_DURATION_MS =
  SUBSCRIPTION_SUCCESS_POLL_INTERVAL_MS * SUBSCRIPTION_SUCCESS_MAX_POLL_ATTEMPTS;

const POLL_INTERVAL_MS = SUBSCRIPTION_SUCCESS_POLL_INTERVAL_MS;
const MAX_POLL_ATTEMPTS = SUBSCRIPTION_SUCCESS_MAX_POLL_ATTEMPTS;

type PageStatus = "polling" | "success" | "timeout";

const SubscriptionSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, refresh } = useCurrentUser({ watchLocation: true });
  const [status, setStatus] = useState<PageStatus>("polling");

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const pollEntitlement = async (): Promise<boolean> => {
      const res = await fetch(apiUrl("/api/users/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.hasLetsReviseProAccess === true) {
        updateUser(data);
        refresh();
        return true;
      }
      return false;
    };

    const run = async () => {
      while (!cancelled && attempts < MAX_POLL_ATTEMPTS) {
        try {
          if (await pollEntitlement()) {
            if (!cancelled) setStatus("success");
            return;
          }
        } catch {
          // transient network — keep polling
        }
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      if (!cancelled) setStatus("timeout");
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token, navigate, refresh]);

  return (
    <div style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>Subscription payment received</h1>

      {sessionId && (
        <p style={{ color: "#666", fontSize: "0.875rem", marginBottom: "1rem" }}>
          Checkout session: {sessionId}
        </p>
      )}

      {status === "polling" && (
        <>
          <p style={{ lineHeight: 1.6 }}>
            Stripe has confirmed your payment. LetsRevise is activating your LetsRevise Pro access —
            this usually takes a few seconds.
          </p>
          <p style={{ color: "#666" }}>Please keep this page open while we verify your subscription.</p>
        </>
      )}

      {status === "success" && (
        <>
          <p style={{ lineHeight: 1.6, color: "#155724" }}>
            LetsRevise Pro is now active on your account. You can browse and unlock premium lessons as they
            become available.
          </p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
            <Link
              to="/browse-lessons"
              style={{
                padding: "0.75rem 1.25rem",
                backgroundColor: "#1976d2",
                color: "white",
                borderRadius: 4,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Browse lessons
            </Link>
            <Link
              to="/student-dashboard"
              style={{
                padding: "0.75rem 1.25rem",
                border: "1px solid #ddd",
                borderRadius: 4,
                textDecoration: "none",
                color: "#333",
                fontWeight: 600,
              }}
            >
              Go to dashboard
            </Link>
          </div>
        </>
      )}

      {status === "timeout" && (
        <>
          <p style={{ lineHeight: 1.6 }}>
            Your payment was received, but LetsRevise Pro access is not active yet. This can happen if
            webhook processing is still in progress.
          </p>
          <p style={{ color: "#666" }}>
            Try refreshing in a minute, or contact support if access does not appear soon.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1.25rem",
              backgroundColor: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Check again
          </button>
        </>
      )}
    </div>
  );
};

export default SubscriptionSuccessPage;
