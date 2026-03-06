/**
 * PR18: Teacher "Needs attention" — lessons ranked by misconception severity (high-conf wrong).
 * PR19: Cold-start — Setup needed (no practice attached / no attempts yet) + tabs.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

const DAYS_OPTIONS = [7, 14, 30] as const;

type NeedsAttentionItem = {
  lessonId: string;
  title: string;
  topic: string;
  tier?: string;
  examBoard?: string;
  status: string;
  readiness: { status: string; signals?: Record<string, unknown> };
  attempts: number;
  uniqueStudents: number;
  accuracy: number;
  highConfidenceWrong: number;
  wrong: number;
  correct: number;
};

type ColdStartRow = {
  lessonId: string;
  title: string;
  topic: string;
  tier?: string;
  examBoard?: string;
  status: string;
  readiness: { status: string; signals?: Record<string, unknown> };
};

type NeedsAttentionResponse = {
  ok: boolean;
  days: number;
  items: NeedsAttentionItem[];
  coldStart?: { noPracticeAttached: ColdStartRow[]; noAttemptsYet: ColdStartRow[] };
  totals?: { needsAttention: number; noPracticeAttached: number; noAttemptsYet: number };
};

type Tab = "misconceptions" | "setup";

export default function TeacherNeedsAttentionPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NeedsAttentionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => (typeof window !== "undefined" && window.location?.hash === "#setup" ? "setup" : "misconceptions"));
  const [fixingLessonId, setFixingLessonId] = useState<string | null>(null);
  const [attachingLessonId, setAttachingLessonId] = useState<string | null>(null);
  /** PR22: Make classroom-ready per row */
  const [preparingLessonId, setPreparingLessonId] = useState<string | null>(null);
  const [prepareErrorLessonId, setPrepareErrorLessonId] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  /** PR22.1: Ready quick actions (Open Classroom + Copy student link) */
  const [readyActionsLessonId, setReadyActionsLessonId] = useState<string | null>(null);
  const [copyLinkFeedback, setCopyLinkFeedback] = useState<"copied" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastClassroomLessonId, setToastClassroomLessonId] = useState<string | null>(null);
  const hasDefaultedToSetup = useRef(typeof window !== "undefined" && window.location?.hash === "#setup");

  /** PR22: plan status → toast suffix */
  const formatPlanStatus = (status: string): string => {
    switch (status) {
      case "UPDATED": return "· plan updated";
      case "CACHED": return "· plan reused";
      case "NOT_CONFIGURED": return "· plan not generated (AI not configured)";
      case "RATE_LIMIT": return "· plan not generated (rate limited)";
      case "ERROR": return "· plan not generated";
      case "SKIPPED": return "· plan skipped";
      default: return "· plan skipped";
    }
  };

  /** PR22.1: clipboard helper (same as PR20.1) */
  function copyToClipboard(text: string): Promise<void> {
    if (navigator?.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise<void>((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) return reject(new Error("copy failed"));
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<NeedsAttentionResponse>("/reports/teacher/needs-attention", {
        params: { days, limit: 20, includeColdStart: true },
      });
      if (res?.data?.ok) setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  // PR19: default to Setup needed tab once when misconceptions empty but cold-start has rows
  useEffect(() => {
    if (!data || hasDefaultedToSetup.current) return;
    const cold = data.coldStart;
    const noPractice = cold?.noPracticeAttached?.length ?? 0;
    const noAttempts = cold?.noAttemptsYet?.length ?? 0;
    if (data.items.length === 0 && (noPractice > 0 || noAttempts > 0)) {
      hasDefaultedToSetup.current = true;
      setActiveTab("setup");
    }
  }, [data]);

  const handleBulkFix = async (lessonId: string) => {
    setFixingLessonId(lessonId);
    try {
      const res = await api.post<{
        ok: boolean;
        attach?: { added: number; addedIds?: string[] };
        plan?: { status: string };
      }>(`/reports/lessons/${lessonId}/one-click-fix-bulk`, {
        days,
        attachByTopic: true,
        attachLimitPerTopic: 10,
        regeneratePlan: true,
        planLimit: 10,
      });
      const d = res?.data;
      if (!d?.ok) {
        setToast("Bulk fix failed");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const added = d?.attach?.added ?? 0;
      const planStatus = d?.plan?.status ?? "SKIPPED";
      let planMsg = "plan updated";
      if (planStatus === "CACHED") planMsg = "plan reused";
      if (planStatus === "NOT_CONFIGURED") planMsg = "plan not generated (AI not configured)";
      if (planStatus === "RATE_LIMIT") planMsg = "plan not generated (rate limited)";
      if (planStatus === "ERROR") planMsg = "plan not generated";
      if (planStatus === "SKIPPED") planMsg = "plan skipped";
      setToast(`Done: +${added} question${added !== 1 ? "s" : ""} · ${planMsg}`);
      setTimeout(() => setToast(null), 4000);
      load();
    } catch (e: any) {
      setToast(e?.response?.data?.error || "Bulk fix failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setFixingLessonId(null);
    }
  };

  const handleAttachPractice = async (lessonId: string) => {
    setAttachingLessonId(lessonId);
    try {
      const res = await api.post<{ ok: boolean; added?: number }>(
        `/lessons/${lessonId}/exam-questions/attach-by-topic`,
        { limit: 10 }
      );
      const added = res?.data?.added ?? 0;
      setToast(`Attached +${added} question${added !== 1 ? "s" : ""}`);
      setToastClassroomLessonId(lessonId);
      setTimeout(() => {
        setToast(null);
        setToastClassroomLessonId(null);
      }, 5000);
      load();
    } catch (e: any) {
      setToast(e?.response?.data?.error || e?.response?.data?.msg || "Attach failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setAttachingLessonId(null);
    }
  };

  /** PR22: Make classroom-ready (PR20 endpoint) per row */
  const handleMakeClassroomReady = async (lessonId: string) => {
    setPrepareErrorLessonId(null);
    setPrepareError(null);
    setReadyActionsLessonId(null);
    setCopyLinkFeedback(null);
    setPreparingLessonId(lessonId);
    try {
      const res = await api.post<{
        ok: boolean;
        attach?: { added: number };
        plan?: { status: string };
        readiness?: { status: string };
      }>(`/reports/lessons/${lessonId}/make-classroom-ready`, {
        days,
        attachPractice: true,
        attachLimit: 10,
        ensureDiagram: true,
        regeneratePlan: true,
        planLimit: 10,
        markReviewed: true,
        forcePlan: false,
      });
      const d = res?.data;
      if (!d?.ok) {
        setPrepareErrorLessonId(lessonId);
        setPrepareError("Request failed");
        return;
      }
      const added = d?.attach?.added ?? 0;
      const planStatus = d?.plan?.status ?? "SKIPPED";
      let msg = `Done: +${added} practice ${formatPlanStatus(planStatus)}`;
      if (d?.readiness?.status === "READY") {
        msg += " · Ready";
        setReadyActionsLessonId(lessonId);
      } else {
        setReadyActionsLessonId(null);
      }
      setToast(msg);
      setTimeout(() => setToast(null), 4000);
      load();
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || e?.response?.data?.message || "Failed to prepare lesson.";
      setPrepareErrorLessonId(lessonId);
      setPrepareError(errMsg);
      setToast(null);
    } finally {
      setPreparingLessonId(null);
    }
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
      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem" }}>Needs attention</h1>
      <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        Lessons ranked by high-confidence wrong answers. Fix top hotspots or open the report.
      </p>

      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, color: "#374151" }}>Last</span>
        {DAYS_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: days === d ? "2px solid #2563eb" : "1px solid #d1d5db",
              background: days === d ? "rgba(37,99,235,0.08)" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {d} days
          </button>
        ))}
      </div>

      {toast && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#d1fae5", color: "#065f46", borderRadius: 8, fontSize: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span>{toast}</span>
          {toastClassroomLessonId && (
            <button
              type="button"
              onClick={() => {
                navigate(`/teacher/classroom/${toastClassroomLessonId}`);
                setToast(null);
                setToastClassroomLessonId(null);
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #059669",
                background: "rgba(5,150,105,0.2)",
                color: "#047857",
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Open Student View now
            </button>
          )}
        </div>
      )}
      {readyActionsLessonId && (
        <div
          style={{
            marginTop: 12,
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(16,185,129,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 800, color: "#047857" }}>Ready — next steps</div>
          <button
            type="button"
            onClick={() => navigate(`/teacher/classroom/${readyActionsLessonId}`)}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "2px solid #10b981",
              background: "rgba(16,185,129,0.12)",
              cursor: "pointer",
              fontWeight: 800,
              color: "#047857",
            }}
          >
            Open Student View
          </button>
          <button
            type="button"
            onClick={async () => {
              const link = `${window.location.origin}/lesson/${readyActionsLessonId}`;
              try {
                await copyToClipboard(link);
                setCopyLinkFeedback("copied");
                setTimeout(() => setCopyLinkFeedback(null), 2000);
              } catch {
                // optional: inline error not required for v1
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {copyLinkFeedback === "copied" ? "Copied" : "Copy student link"}
          </button>
        </div>
      )}
      {loading && <div style={{ color: "#6b7280", marginBottom: 16 }}>Loading…</div>}
      {error && <div style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</div>}

      {!loading && data && (
        <>
          {(() => {
            const hasMisconceptions = data.items.length > 0;
            const cold = data.coldStart;
            const noPractice = cold?.noPracticeAttached ?? [];
            const noAttempts = cold?.noAttemptsYet ?? [];
            const hasSetup = noPractice.length > 0 || noAttempts.length > 0;
            const showTabs = hasMisconceptions || hasSetup;

            if (!showTabs) {
              return (
                <p style={{ color: "#6b7280" }}>
                  No practice attempts in the last {data.days} days and no setup needed. Publish lessons and attach practice to see them here.
                </p>
              );
            }

            return (
              <>
                <div style={{ marginBottom: 16, display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("misconceptions")}
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      borderBottom: activeTab === "misconceptions" ? "2px solid #2563eb" : "2px solid transparent",
                      background: "none",
                      color: activeTab === "misconceptions" ? "#2563eb" : "#6b7280",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Student misconceptions {hasMisconceptions ? `(${data.items.length})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("setup")}
                    style={{
                      padding: "8px 16px",
                      border: "none",
                      borderBottom: activeTab === "setup" ? "2px solid #2563eb" : "2px solid transparent",
                      background: "none",
                      color: activeTab === "setup" ? "#2563eb" : "#6b7280",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Setup needed {hasSetup ? `(${noPractice.length + noAttempts.length})` : ""}
                  </button>
                </div>

                {activeTab === "misconceptions" && (
                  <>
                    {!hasMisconceptions ? (
                      <p style={{ color: "#6b7280" }}>No practice attempts in the last {data.days} days. Use the Setup needed tab to attach practice and run Classroom mode.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={thTdStyle}>Lesson · Topic</th>
                              <th style={{ ...thTdStyle, textAlign: "right" }}>High-conf wrong</th>
                              <th style={{ ...thTdStyle, textAlign: "right" }}>Accuracy</th>
                              <th style={{ ...thTdStyle, textAlign: "right" }}>Attempts</th>
                              <th style={{ ...thTdStyle, textAlign: "right" }}>Students</th>
                              <th style={thTdStyle}>Readiness</th>
                              <th style={thTdStyle}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.items.map((row) => (
                              <tr key={row.lessonId}>
                                <td style={thTdStyle}>
                                  <strong>{row.title || "—"}</strong>
                                  {row.topic && <span style={{ color: "#6b7280", fontSize: 12, display: "block" }}>{row.topic}</span>}
                                </td>
                                <td style={{ ...thTdStyle, textAlign: "right", color: row.highConfidenceWrong > 0 ? "#b91c1c" : undefined }}>
                                  {row.highConfidenceWrong}
                                </td>
                                <td style={{ ...thTdStyle, textAlign: "right" }}>{typeof row.accuracy === "number" ? `${(row.accuracy * 100).toFixed(0)}%` : "—"}</td>
                                <td style={{ ...thTdStyle, textAlign: "right" }}>{row.attempts}</td>
                                <td style={{ ...thTdStyle, textAlign: "right" }}>{row.uniqueStudents}</td>
                                <td style={thTdStyle}>
                                  <span
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background:
                                        row.readiness?.status === "READY"
                                          ? "#d1fae5"
                                          : row.readiness?.status === "NEEDS_REVIEW"
                                            ? "#fef3c7"
                                            : "#e5e7eb",
                                      color:
                                        row.readiness?.status === "READY"
                                          ? "#065f46"
                                          : row.readiness?.status === "NEEDS_REVIEW"
                                            ? "#92400e"
                                            : "#374151",
                                    }}
                                  >
                                    {row.readiness?.status ?? "DRAFT"}
                                  </span>
                                </td>
                                <td style={thTdStyle}>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                    <button
                                      type="button"
                                      disabled={preparingLessonId === row.lessonId}
                                      onClick={() => handleMakeClassroomReady(row.lessonId)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "2px solid #059669",
                                        background: preparingLessonId === row.lessonId ? "#e5e7eb" : "rgba(5,150,105,0.12)",
                                        cursor: preparingLessonId === row.lessonId ? "not-allowed" : "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#047857",
                                      }}
                                    >
                                      {preparingLessonId === row.lessonId ? "Preparing…" : "Make classroom-ready"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={fixingLessonId === row.lessonId}
                                      onClick={() => handleBulkFix(row.lessonId)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #059669",
                                        background: fixingLessonId === row.lessonId ? "#e5e7eb" : "rgba(5,150,105,0.08)",
                                        cursor: fixingLessonId === row.lessonId ? "not-allowed" : "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#047857",
                                      }}
                                    >
                                      {fixingLessonId === row.lessonId ? "Fixing…" : "Fix top hotspots (3)"}
                                    </button>
                                    <Link
                                      to={`/teacher/reports/lesson/${row.lessonId}`}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #2563eb",
                                        background: "rgba(37,99,235,0.08)",
                                        color: "#2563eb",
                                        textDecoration: "none",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Open report
                                    </Link>
                                    <Link
                                      to={`/edit-lesson/${row.lessonId}`}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #64748b",
                                        background: "#f1f5f9",
                                        color: "#475569",
                                        textDecoration: "none",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Open editor
                                    </Link>
                                  </div>
                                  {prepareErrorLessonId === row.lessonId && prepareError && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{prepareError}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {activeTab === "setup" && (
                  <div>
                    {!hasMisconceptions && (
                      <p style={{ color: "#6b7280", marginBottom: 16 }}>
                        No student attempts yet — start by attaching practice and using Classroom mode.
                      </p>
                    )}
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "1rem" }}>No practice attached</h3>
                    {noPractice.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>All published lessons have practice attached.</p>
                    ) : (
                      <div style={{ overflowX: "auto", marginBottom: 24 }}>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={thTdStyle}>Lesson · Topic</th>
                              <th style={thTdStyle}>Readiness</th>
                              <th style={thTdStyle}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {noPractice.map((row) => (
                              <tr key={row.lessonId}>
                                <td style={thTdStyle}>
                                  <strong>{row.title || "—"}</strong>
                                  {row.topic && <span style={{ color: "#6b7280", fontSize: 12, display: "block" }}>{row.topic}</span>}
                                  {row.tier && <span style={{ fontSize: 12, color: "#6b7280" }}>{row.tier}</span>}
                                </td>
                                <td style={thTdStyle}>
                                  <span
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background:
                                        row.readiness?.status === "READY"
                                          ? "#d1fae5"
                                          : row.readiness?.status === "NEEDS_REVIEW"
                                            ? "#fef3c7"
                                            : "#e5e7eb",
                                      color:
                                        row.readiness?.status === "READY"
                                          ? "#065f46"
                                          : row.readiness?.status === "NEEDS_REVIEW"
                                            ? "#92400e"
                                            : "#374151",
                                    }}
                                  >
                                    {row.readiness?.status ?? "DRAFT"}
                                  </span>
                                </td>
                                <td style={thTdStyle}>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                    <button
                                      type="button"
                                      disabled={preparingLessonId === row.lessonId}
                                      onClick={() => handleMakeClassroomReady(row.lessonId)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "2px solid #059669",
                                        background: preparingLessonId === row.lessonId ? "#e5e7eb" : "rgba(5,150,105,0.12)",
                                        cursor: preparingLessonId === row.lessonId ? "not-allowed" : "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#047857",
                                      }}
                                    >
                                      {preparingLessonId === row.lessonId ? "Preparing…" : "Make classroom-ready"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={attachingLessonId === row.lessonId}
                                      onClick={() => handleAttachPractice(row.lessonId)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #059669",
                                        background: attachingLessonId === row.lessonId ? "#e5e7eb" : "rgba(5,150,105,0.08)",
                                        cursor: attachingLessonId === row.lessonId ? "not-allowed" : "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#047857",
                                      }}
                                    >
                                      {attachingLessonId === row.lessonId ? "Attaching…" : "Attach practice (top 10)"}
                                    </button>
                                  </div>
                                  {prepareErrorLessonId === row.lessonId && prepareError && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{prepareError}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "1rem" }}>No attempts yet</h3>
                    {noAttempts.length === 0 ? (
                      <p style={{ color: "#6b7280", fontSize: 14 }}>No published lessons with practice have zero attempts in the window.</p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={thTdStyle}>Lesson · Topic</th>
                              <th style={thTdStyle}>Readiness</th>
                              <th style={thTdStyle}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {noAttempts.map((row) => (
                              <tr key={row.lessonId}>
                                <td style={thTdStyle}>
                                  <strong>{row.title || "—"}</strong>
                                  {row.topic && <span style={{ color: "#6b7280", fontSize: 12, display: "block" }}>{row.topic}</span>}
                                  {row.tier && <span style={{ fontSize: 12, color: "#6b7280" }}>{row.tier}</span>}
                                </td>
                                <td style={thTdStyle}>
                                  <span
                                    style={{
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background:
                                        row.readiness?.status === "READY"
                                          ? "#d1fae5"
                                          : row.readiness?.status === "NEEDS_REVIEW"
                                            ? "#fef3c7"
                                            : "#e5e7eb",
                                      color:
                                        row.readiness?.status === "READY"
                                          ? "#065f46"
                                          : row.readiness?.status === "NEEDS_REVIEW"
                                            ? "#92400e"
                                            : "#374151",
                                    }}
                                  >
                                    {row.readiness?.status ?? "DRAFT"}
                                  </span>
                                </td>
                                <td style={thTdStyle}>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                    <button
                                      type="button"
                                      disabled={preparingLessonId === row.lessonId}
                                      onClick={() => handleMakeClassroomReady(row.lessonId)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "2px solid #059669",
                                        background: preparingLessonId === row.lessonId ? "#e5e7eb" : "rgba(5,150,105,0.12)",
                                        cursor: preparingLessonId === row.lessonId ? "not-allowed" : "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: "#047857",
                                      }}
                                    >
                                      {preparingLessonId === row.lessonId ? "Preparing…" : "Make classroom-ready"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/teacher/classroom/${row.lessonId}`)}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #2563eb",
                                        background: "rgba(37,99,235,0.08)",
                                        color: "#2563eb",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Open classroom mode
                                    </button>
                                    <Link
                                      to={`/lesson/${row.lessonId}`}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #64748b",
                                        background: "#f1f5f9",
                                        color: "#475569",
                                        textDecoration: "none",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Open lesson
                                    </Link>
                                    <Link
                                      to={`/teacher/reports/lesson/${row.lessonId}`}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #6366f1",
                                        background: "rgba(99,102,241,0.08)",
                                        color: "#6366f1",
                                        textDecoration: "none",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Open report
                                    </Link>
                                  </div>
                                  {prepareErrorLessonId === row.lessonId && prepareError && (
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>{prepareError}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
