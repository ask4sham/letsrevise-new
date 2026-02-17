/**
 * PR12: Teacher lesson attempts summary (practice + checkpoint).
 * PR13: Question insights (top misconceptions, topic hot-spots).
 */
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../services/api";

type AttemptsSummary = {
  ok: boolean;
  lessonId: string;
  days: number;
  totalAttempts: number;
  uniqueStudents: number;
  accuracy: number;
  bySource: { checkpoint: number; practice: number };
  confidenceCounts?: { 1: number; 2: number; 3: number };
};

type QuestionInsightItem = {
  questionId: string;
  question?: string;
  marks?: number;
  topicKey?: string;
  topic?: string;
  type?: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracy: number | null;
  highConfidenceWrong: number;
  avgConfidence?: number;
};

type TopicHotSpot = {
  topicKey: string;
  topic?: string;
  attempts: number;
  wrong: number;
  correct: number;
  highConfidenceWrong: number;
};

type QuestionInsightsResponse = {
  ok: boolean;
  days: number;
  lessonId: string;
  items: QuestionInsightItem[];
  topics: TopicHotSpot[];
};

export default function LessonAttemptReportPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AttemptsSummary | null>(null);
  const [insights, setInsights] = useState<QuestionInsightsResponse | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const days = 7;

  useEffect(() => {
    if (!id) {
      setError("Missing lesson id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSummary(null);
    setInsights(null);
    Promise.allSettled([
      api.get<AttemptsSummary>(`/reports/lessons/${id}/attempts-summary`, { params: { days } }),
      api.get<QuestionInsightsResponse>(`/reports/lessons/${id}/question-insights`, {
        params: { days, limit: 10 },
      }),
    ])
      .then(([summaryResult, insightsResult]) => {
        if (cancelled) return;
        if (summaryResult.status === "fulfilled" && summaryResult.value?.data?.ok) {
          setSummary(summaryResult.value.data);
        } else if (summaryResult.status === "rejected") {
          setError(summaryResult.reason?.response?.data?.error || summaryResult.reason?.message || "Failed to load report");
        }
        if (insightsResult.status === "fulfilled" && insightsResult.value?.data?.ok) {
          setInsights(insightsResult.value.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ color: "#6b7280" }}>Loading attempts report…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</div>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb" }}>Back to Dashboard</Link>
      </div>
    );
  }
  if (!summary) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ color: "#6b7280" }}>No data.</div>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb" }}>Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem" }}>Lesson attempts</h1>
      <p style={{ margin: "0 0 24px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        Last {summary.days} days
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ padding: 16, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Attempts</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>{summary.totalAttempts}</div>
        </div>
        <div style={{ padding: 16, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Students</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>{summary.uniqueStudents}</div>
        </div>
        <div style={{ padding: 16, borderRadius: 10, border: "1px solid #86efac", background: "#dcfce7" }}>
          <div style={{ fontSize: 12, color: "#166534", marginBottom: 4 }}>Accuracy</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#166534" }}>{summary.accuracy}%</div>
        </div>
      </div>
      <div style={{ padding: 16, borderRadius: 10, border: "1px solid #e5e7eb", background: "#fafafa" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>By source</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <span>Checkpoint: {summary.bySource.checkpoint}</span>
          <span>Practice: {summary.bySource.practice}</span>
        </div>
      </div>
      {summary.confidenceCounts && (
        <div style={{ marginTop: 12, padding: 16, borderRadius: 10, border: "1px solid #e5e7eb", background: "#fafafa" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Confidence</div>
          <div style={{ fontSize: 14, color: "#374151" }}>
            Low {summary.confidenceCounts[1] ?? 0} / Med {summary.confidenceCounts[2] ?? 0} / High {summary.confidenceCounts[3] ?? 0}
          </div>
        </div>
      )}

      {insights && (insights.items.length > 0 || insights.topics.length > 0) && (
        <>
          <h2 style={{ margin: "24px 0 12px 0", fontSize: "1.2rem" }}>Question insights</h2>

          {insights.items.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Top misconceptions (high confidence wrong)</div>
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Question</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>Attempts</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>Accuracy %</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>High-conf wrong</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #e5e7eb" }}>Avg confidence</th>
                      <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Topic</th>
                      <th style={{ padding: "10px 12px", width: 40, borderBottom: "1px solid #e5e7eb" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.items.map((row) => {
                      const questionPreview = (row.question ?? "").slice(0, 80);
                      const isExpanded = expandedQuestionId === row.questionId;
                      return (
                        <tr
                          key={row.questionId}
                          style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                          onClick={() => setExpandedQuestionId(isExpanded ? null : row.questionId)}
                        >
                          <td style={{ padding: "10px 12px", color: "#374151" }}>
                            {isExpanded ? (row.question ?? "—") : questionPreview + (questionPreview.length >= 80 ? "…" : "")}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{row.attempts}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {row.accuracy != null ? Math.round(row.accuracy * 100) : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: row.highConfidenceWrong > 0 ? "#b91c1c" : undefined }}>
                            {row.highConfidenceWrong}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>
                            {row.avgConfidence != null ? Number(row.avgConfidence).toFixed(1) : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#6b7280" }}>{row.topic ?? row.topicKey ?? "—"}</td>
                          <td style={{ padding: "10px 12px" }}>{isExpanded ? "▼" : "▶"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {insights.topics.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Topic hot-spots</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {insights.topics.map((t) => (
                  <div
                    key={t.topicKey}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: t.highConfidenceWrong > 0 ? "#fef2f2" : "#f9fafb",
                      fontSize: 14,
                      color: "#374151",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{t.topic ?? t.topicKey}</span>
                    {" · "}
                    Wrong {t.wrong} / {t.attempts} attempts
                    {t.highConfidenceWrong > 0 && (
                      <span style={{ color: "#b91c1c", marginLeft: 8 }}>
                        High-conf wrong: {t.highConfidenceWrong}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
