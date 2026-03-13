/**
 * PR12.1: Teacher roll-up attempts summary (top lessons by attempts, lowest accuracy).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const DAYS_OPTIONS = [7, 14, 30] as const;

type LessonAttemptRow = {
  lessonId: string;
  title: string;
  topic: string;
  total: number;
  correct: number;
  accuracy: number;
};

type TeacherAttemptsSummary = {
  ok: boolean;
  days: number;
  topLessonsByAttempts: LessonAttemptRow[];
  lowestAccuracyLessons: LessonAttemptRow[];
  confidenceCounts?: { 1: number; 2: number; 3: number };
};

export default function TeacherAttemptsSummaryPage() {
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeacherAttemptsSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TeacherAttemptsSummary>("/reports/teacher/attempts-summary", {
        params: { days },
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
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem" }}>Practice monitoring</h1>
      <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        Checkpoint and practice attempts across your lessons
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

      {loading && <div style={{ color: "#6b7280", marginBottom: 16 }}>Loading…</div>}
      {error && <div style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</div>}

      {!loading && data && (
        <>
          {data.confidenceCounts && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 14, color: "#374151" }}>
              Confidence: Low {data.confidenceCounts[1] ?? 0} / Med {data.confidenceCounts[2] ?? 0} / High {data.confidenceCounts[3] ?? 0}
            </div>
          )}
          <h2 style={{ margin: "16px 0 8px 0", fontSize: "1.1rem" }}>Top lessons by attempts</h2>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: 24 }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thTdStyle}>Title</th>
                  <th style={thTdStyle}>Topic</th>
                  <th style={{ ...thTdStyle, textAlign: "right" }}>Attempts</th>
                  <th style={{ ...thTdStyle, textAlign: "right" }}>Accuracy</th>
                  <th style={thTdStyle}></th>
                </tr>
              </thead>
              <tbody>
                {data.topLessonsByAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={thTdStyle}>
                      No attempts in this period
                    </td>
                  </tr>
                ) : (
                  data.topLessonsByAttempts.map((row) => (
                    <tr key={row.lessonId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={thTdStyle}>{row.title}</td>
                      <td style={thTdStyle}>{row.topic || "—"}</td>
                      <td style={{ ...thTdStyle, textAlign: "right" }}>{row.total}</td>
                      <td style={{ ...thTdStyle, textAlign: "right" }}>{row.accuracy}%</td>
                      <td style={thTdStyle}>
                        <Link to={`/teacher/reports/lesson/${row.lessonId}`} style={{ fontSize: 13, color: "#2563eb" }}>
                          Report
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 style={{ margin: "16px 0 8px 0", fontSize: "1.1rem" }}>Lowest accuracy lessons</h2>
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thTdStyle}>Title</th>
                  <th style={thTdStyle}>Topic</th>
                  <th style={{ ...thTdStyle, textAlign: "right" }}>Attempts</th>
                  <th style={{ ...thTdStyle, textAlign: "right" }}>Accuracy</th>
                  <th style={thTdStyle}></th>
                </tr>
              </thead>
              <tbody>
                {data.lowestAccuracyLessons.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={thTdStyle}>
                      No lessons with attempts in this period
                    </td>
                  </tr>
                ) : (
                  data.lowestAccuracyLessons.map((row) => (
                    <tr key={row.lessonId} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={thTdStyle}>{row.title}</td>
                      <td style={thTdStyle}>{row.topic || "—"}</td>
                      <td style={{ ...thTdStyle, textAlign: "right" }}>{row.total}</td>
                      <td style={{ ...thTdStyle, textAlign: "right" }}>{row.accuracy}%</td>
                      <td style={thTdStyle}>
                        <Link to={`/teacher/reports/lesson/${row.lessonId}`} style={{ fontSize: 13, color: "#2563eb" }}>
                          Report
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
