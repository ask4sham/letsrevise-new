/**
 * Hidden monitoring verification page — #/monitoring
 * Not linked from normal navigation. For operational verification of Sentry.
 */
import React, { useState, useEffect } from "react";
import api from "../services/api";
import { getApiClientErrorMessage, getHttpStatus } from "../utils/apiErrorMessage";
import { apiUrl } from "../utils/apiBaseUrl";

export default function MonitoringVerificationPage() {
  const [healthStatus, setHealthStatus] = useState<{
    ok?: boolean;
    error?: string;
    data?: unknown;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    status?: number;
    ok?: boolean;
    error?: string;
    data?: unknown;
  } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingTest, setLoadingTest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingHealth(true);
    fetch(apiUrl("/api/health"))
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled) {
          setHealthStatus({ ok: true, data });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHealthStatus({ ok: false, error: err?.message || "Failed to fetch" });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHealth(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerTestError = async () => {
    setLoadingTest(true);
    setTestResult(null);
    try {
      const res = await api.get("/monitoring/test-error", {
        headers: { "x-monitoring-test": "true" },
        validateStatus: () => true,
      });
      setTestResult({
        status: res.status,
        ok: res.status >= 200 && res.status < 300,
        data: res.data,
      });
    } catch (err: unknown) {
      const e = err as { data?: unknown; response?: { data?: unknown } };
      setTestResult({
        status: getHttpStatus(err),
        ok: false,
        error: getApiClientErrorMessage(err, "Request failed"),
        data: e?.response?.data ?? e?.data,
      });
    } finally {
      setLoadingTest(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Monitoring Verification</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
        Hidden page for operational verification. Not linked from navigation.
      </p>

      <section style={{ marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Backend health</h2>
        {loadingHealth ? (
          <div style={{ color: "#64748b" }}>Loading…</div>
        ) : healthStatus?.ok ? (
          <div>
            <div style={{ color: "#16a34a", fontWeight: 600 }}>OK</div>
            <pre style={{ marginTop: 8, fontSize: 12, overflow: "auto" }}>
              {JSON.stringify(healthStatus.data, null, 2)}
            </pre>
          </div>
        ) : (
          <div>
            <div style={{ color: "#dc2626", fontWeight: 600 }}>Failed</div>
            <div style={{ marginTop: 4, fontSize: 14 }}>{healthStatus?.error}</div>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: 12 }}>Backend Sentry test</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          Triggers GET /api/monitoring/test-error (only works in production with header x-monitoring-test: true).
          The backend will throw an error so Sentry captures it.
        </p>
        <button
          type="button"
          onClick={triggerTestError}
          disabled={loadingTest}
          style={{
            padding: "8px 16px",
            background: loadingTest ? "#94a3b8" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: loadingTest ? "not-allowed" : "pointer",
          }}
        >
          {loadingTest ? "Sending…" : "Trigger test error"}
        </button>

        {testResult && (
          <div style={{ marginTop: 16, padding: 12, background: "white", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Response: HTTP {testResult.status}
              {testResult.ok ? (
                <span style={{ color: "#16a34a", marginLeft: 8 }}>OK</span>
              ) : (
                <span style={{ color: "#dc2626", marginLeft: 8 }}>Error</span>
              )}
            </div>
            {testResult.error && (
              <div style={{ color: "#dc2626", marginBottom: 8 }}>{testResult.error}</div>
            )}
            <pre style={{ fontSize: 12, overflow: "auto", margin: 0 }}>
              {JSON.stringify(testResult.data, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <p style={{ fontSize: 12, color: "#94a3b8" }}>
        See docs/PRODUCTION_MONITORING.md for full verification steps.
      </p>
    </div>
  );
}
