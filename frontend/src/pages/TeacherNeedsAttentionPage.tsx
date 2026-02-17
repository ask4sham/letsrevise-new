/**
 * PR18: Teacher "Needs attention" — lessons ranked by misconception severity (high-conf wrong).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

type NeedsAttentionResponse = {
  ok: boolean;
  days: number;
  items: NeedsAttentionItem[];
};

export default function TeacherNeedsAttentionPage() {
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NeedsAttentionResponse | null>(null);
  const [fixingLessonId, setFixingLessonId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<NeedsAttentionResponse>("/reports/teacher/needs-attention", {
        params: { days, limit: 20 },
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
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#d1fae5", color: "#065f46", borderRadius: 8, fontSize: 14 }}>
          {toast}
        </div>
      )}
      {loading && <div style={{ color: "#6b7280", marginBottom: 16 }}>Loading…</div>}
      {error && <div style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</div>}

      {!loading && data && (
        <>
          {data.items.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No practice attempts in the last {data.days} days. Data will appear once students attempt your lessons.</p>
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <button
                            type="button"
                            disabled={fixingLessonId === row.lessonId}
                            onClick={() => handleBulkFix(row.lessonId)}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "2px solid #059669",
                              background: fixingLessonId === row.lessonId ? "#e5e7eb" : "rgba(5,150,105,0.12)",
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
