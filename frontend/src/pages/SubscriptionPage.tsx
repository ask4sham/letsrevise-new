import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "../utils/money";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getErrorMessageFromData } from "../utils/apiErrorMessage";
import { apiUrl } from "../utils/apiBaseUrl";
import { updateUser } from "../utils/authStorage";
import VerificationGate from "../components/auth/VerificationGate";

/** Frozen B4 display contract — must match Stripe LetsRevise Pro launch price. */
const LETSREVISE_PRO_DISPLAY = {
  currency: "GBP",
  monthlyAmountPence: 499,
} as const;

const PRO_FEATURES = [
  "Universal premium access across all available subjects",
  "Full lesson access, practice, and quizzes",
  "AI tutor included",
  "Automatically includes new subjects as they launch",
];

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { token, refresh } = useCurrentUser({ watchLocation: true });
  const [hasLetsReviseProAccess, setHasLetsReviseProAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadEntitlement = useCallback(async (): Promise<boolean> => {
    if (!token) {
      setHasLetsReviseProAccess(false);
      return false;
    }

    const response = await fetch(apiUrl("/api/users/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to load subscription status");
    }

    const data = await response.json();
    const entitled = data?.hasLetsReviseProAccess === true;
    setHasLetsReviseProAccess(entitled);
    updateUser(data);
    refresh();
    return entitled;
  }, [token, refresh]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        await loadEntitlement();
      } catch (error) {
        console.error("Error loading subscription page:", error);
        if (!cancelled) {
          setMessage({ type: "error", text: "Failed to load subscription status" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [loadEntitlement]);

  const handleManageBilling = async () => {
    if (processing || !hasLetsReviseProAccess) return;

    setProcessing(true);
    setMessage(null);

    try {
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(apiUrl("/api/subscriptions/create-portal-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }

      setMessage({
        type: "error",
        text: getErrorMessageFromData(data, "Failed to open billing portal"),
      });
    } catch (error) {
      console.error("Portal error:", error);
      setMessage({ type: "error", text: "Failed to open billing portal" });
    } finally {
      setProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    if (processing) return;

    setProcessing(true);
    setMessage(null);

    try {
      if (!token) {
        navigate("/login");
        return;
      }

      const entitled = await loadEntitlement();
      if (entitled) {
        setMessage({
          type: "error",
          text: "LetsRevise Pro is already active on your account.",
        });
        return;
      }

      const response = await fetch(apiUrl("/api/subscriptions/create-checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }

      setMessage({
        type: "error",
        text: getErrorMessageFromData(data, "Failed to start checkout"),
      });
    } catch (error) {
      console.error("Checkout error:", error);
      setMessage({ type: "error", text: "Failed to start checkout" });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh",
        }}
      >
        Loading subscription information...
      </div>
    );
  }

  return (
    <VerificationGate>
      <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem", fontWeight: "bold" }}>
            LetsRevise Pro
          </h1>
          <p style={{ color: "#666", lineHeight: 1.6 }}>
            One subscription for premium access across Biology today and every subject as it becomes
            available — no extra purchase required.
          </p>
        </div>

        {message && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: message.type === "success" ? "#d4edda" : "#f8d7da",
              color: message.type === "success" ? "#155724" : "#721c24",
              border: `1px solid ${message.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
              borderRadius: "4px",
              marginBottom: "1.5rem",
            }}
          >
            {message.text}
          </div>
        )}

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "2rem",
            backgroundColor: "white",
            boxShadow: hasLetsReviseProAccess ? "0 0 0 2px #1976d2" : "none",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#1976d2" }}>LetsRevise Pro</h2>

          {hasLetsReviseProAccess ? (
            <>
              <p
                style={{
                  marginTop: 0,
                  marginBottom: "1rem",
                  color: "#155724",
                  fontWeight: 600,
                }}
              >
                LetsRevise Pro — Active
              </p>
              <p style={{ color: "#495057", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                Your premium access is active. Manage your subscription, payment method, and
                invoices in Stripe.
              </p>
              <button
                type="button"
                onClick={handleManageBilling}
                disabled={processing}
                style={{
                  width: "100%",
                  padding: "1rem",
                  backgroundColor: "#1976d2",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "1rem",
                  cursor: processing ? "default" : "pointer",
                  opacity: processing ? 0.7 : 1,
                }}
              >
                {processing ? "Opening billing portal..." : "Manage billing"}
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: "1.5rem" }}>
                <span style={{ fontSize: "2.5rem", fontWeight: "bold" }}>
                  {formatMoney(LETSREVISE_PRO_DISPLAY.monthlyAmountPence, LETSREVISE_PRO_DISPLAY.currency)}
                </span>
                <span style={{ color: "#666" }}>/month</span>
              </div>

              <ul style={{ paddingLeft: "1.5rem", margin: "0 0 2rem 0" }}>
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} style={{ marginBottom: "0.5rem" }}>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={handleSubscribe}
                disabled={processing}
                style={{
                  width: "100%",
                  padding: "1rem",
                  backgroundColor: "#1976d2",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "1rem",
                  cursor: processing ? "default" : "pointer",
                  opacity: processing ? 0.7 : 1,
                }}
              >
                {processing ? "Redirecting to checkout..." : "Subscribe"}
              </button>
            </>
          )}
        </div>
      </div>
    </VerificationGate>
  );
};

export default SubscriptionPage;
