/**
 * PR-EDGE-5.1: At-risk drill-down — low-score attempts list
 * PR-EDGE-5.2: One-click remedial assignment
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getTeacherAtRisk,
  assignRemedialFromAtRisk,
  type AtRiskItem,
  type AssignRemedialResponse,
} from "../api/teacherOverview";

const THRESHOLD_OPTIONS = [
  { value: 0.2, label: "20%" },
  { value: 0.3, label: "30%" },
  { value: 0.4, label: "40%" },
  { value: 0.5, label: "50%" },
] as const;

const DAYS_OPTIONS = [7, 14, 30] as const;
const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "worksheet", label: "Worksheets" },
  { value: "quiz", label: "Quizzes" },
  { value: "assessment", label: "Assessments" },
] as const;

export default function TeacherAtRiskPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AtRiskItem[]>([]);
  const [threshold, setThreshold] = useState(() => {
    const t = parseFloat(searchParams.get("threshold") || "0.4");
    return THRESHOLD_OPTIONS.some((o) => o.value === t) ? t : 0.4;
  });
  const [days, setDays] = useState<number>(() => {
    const d = parseInt(searchParams.get("days") || "7", 10);
    return (DAYS_OPTIONS as readonly number[]).includes(d) ? d : 7;
  });
  const [type, setType] = useState<"worksheet" | "quiz" | "assessment" | "all">(
    () => (searchParams.get("type") as any) || "all"
  );
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<AssignRemedialResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeacherAtRisk({ threshold, days, type });
      setItems(res?.items ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [threshold, days, type]);

  useEffect(() => {
    load();
  }, [load]);

  const getBaseUrl = () => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}`;
  };

  const handleAssignRemedial = async (item: AtRiskItem, kind: "quiz" | "assessment") => {
    const topicKeyVal = (item.topicKey || "").trim();
    if (!topicKeyVal) {
      setAssignError("Topic not available for this item");
      return;
    }
    const key = `${item.attemptId}-${kind}`;
    setAssigning(key);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      const result = await assignRemedialFromAtRisk({ topicKey: topicKeyVal, kind });
      setAssignSuccess(result);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Failed to create assignment";
      setAssignError(msg);
    } finally {
      setAssigning(null);
    }
  };

  const copyShareUrl = () => {
    if (!assignSuccess) return;
    const url = `${getBaseUrl()}${assignSuccess.shareUrl}`;
    navigator.clipboard?.writeText(url);
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  };
  const thTdStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem" }}>At-risk attempts</h1>
      <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        Attempts with score below threshold — filter and take action
      </p>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#374151" }}>Threshold:</span>
          <select
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            {THRESHOLD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#374151" }}>Days:</span>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#374151" }}>Type:</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {error && (
        <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>
      )}
      {assignError && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: 8,
          }}
        >
          {assignError}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p style={{ color: "#6b7280", padding: 24, background: "#f9fafb", borderRadius: 8 }}>
          No at-risk attempts found for the selected filters.
        </p>
      )}

      {assignSuccess && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setAssignSuccess(null)}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              maxWidth: 480,
              width: "90%",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Assignment created</h3>
            <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: 14 }}>
              Share this link with students:
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
              }}
            >
              <input
                type="text"
                readOnly
                value={`${getBaseUrl()}${assignSuccess.shareUrl}`}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={copyShareUrl}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Copy
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <a
                href={`${getBaseUrl()}${assignSuccess.shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  color: "#2563eb",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => setAssignSuccess(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#f9fafb",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={thTdStyle}>Title</th>
                <th style={thTdStyle}>Type</th>
                <th style={thTdStyle}>Topic</th>
                <th style={thTdStyle}>Submitted</th>
                <th style={thTdStyle}>Score</th>
                <th style={thTdStyle}>Released</th>
                <th style={thTdStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.type}-${item.attemptId}`}>
                  <td style={thTdStyle}>{item.title}</td>
                  <td style={thTdStyle}>{item.type}</td>
                  <td style={thTdStyle}>{item.topicKey || "—"}</td>
                  <td style={thTdStyle}>
                    {item.submittedAt
                      ? new Date(item.submittedAt).toLocaleDateString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td style={thTdStyle}>
                    {item.score} / {item.maxScore} ({(item.ratio * 100).toFixed(0)}%)
                  </td>
                  <td style={thTdStyle}>{item.isReleased ? "Yes" : "No"}</td>
                  <td style={thTdStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                      <Link
                        to={item.link}
                        style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}
                      >
                        View
                      </Link>
                      {item.topicKey && item.topicKey.trim() && (
                        <>
                          {item.type === "quiz" && (
                            <button
                              type="button"
                              disabled={!!assigning}
                              onClick={() => handleAssignRemedial(item, "quiz")}
                              style={{
                                padding: "4px 10px",
                                fontSize: 12,
                                borderRadius: 6,
                                border: "1px solid #2563eb",
                                background: assigning ? "#e5e7eb" : "#eff6ff",
                                color: "#2563eb",
                                cursor: assigning ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {assigning === `${item.attemptId}-quiz` ? "Creating…" : "Assign remedial quiz"}
                            </button>
                          )}
                          {item.type === "assessment" && (
                            <button
                              type="button"
                              disabled={!!assigning}
                              onClick={() => handleAssignRemedial(item, "assessment")}
                              style={{
                                padding: "4px 10px",
                                fontSize: 12,
                                borderRadius: 6,
                                border: "1px solid #7c3aed",
                                background: assigning ? "#e5e7eb" : "#f5f3ff",
                                color: "#7c3aed",
                                cursor: assigning ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {assigning === `${item.attemptId}-assessment` ? "Creating…" : "Assign remedial assessment"}
                            </button>
                          )}
                          {item.type === "worksheet" && (
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                disabled={!!assigning}
                                onClick={() => handleAssignRemedial(item, "quiz")}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 12,
                                  borderRadius: 6,
                                  border: "1px solid #2563eb",
                                  background: assigning ? "#e5e7eb" : "#eff6ff",
                                  color: "#2563eb",
                                  cursor: assigning ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                {assigning?.startsWith(item.attemptId) ? "Creating…" : "Assign remedial quiz"}
                              </button>
                              <button
                                type="button"
                                disabled={!!assigning}
                                onClick={() => handleAssignRemedial(item, "assessment")}
                                style={{
                                  padding: "4px 10px",
                                  fontSize: 12,
                                  borderRadius: 6,
                                  border: "1px solid #7c3aed",
                                  background: assigning ? "#e5e7eb" : "#f5f3ff",
                                  color: "#7c3aed",
                                  cursor: assigning ? "not-allowed" : "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                {assigning?.startsWith(item.attemptId) ? "Creating…" : "Assign remedial assessment"}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
