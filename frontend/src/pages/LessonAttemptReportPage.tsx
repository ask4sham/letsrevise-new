/**
 * PR12: Teacher lesson attempts summary (practice + checkpoint).
 * PR13: Question insights (top misconceptions, topic hot-spots).
 * PR14: Reteach plan (AI, cached, editable).
 */
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { LessonMarkdown } from "../components/lesson/LessonMarkdown";
import { LessonImageLightboxProvider } from "../components/lesson/LessonImageLightbox";
import { lessonMarkdownUrlTransform } from "../components/lesson/lessonMarkdownViewComponents";
import { preprocessMarkdownAssetUrls } from "../utils/assetUrl";
import api from "../services/api";
import { getApiClientErrorMessage, getHttpStatus } from "../utils/apiErrorMessage";

type ReteachPlanResponse = {
  ok: boolean;
  plan: {
    content: string;
    pinned: boolean;
    generatedAt: string;
    days: number;
    sourceHash?: string;
    editedAt?: string | null;
    studentSummary?: string;
    classroomNotes?: string;
  };
};

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
  const [days, setDays] = useState(7);
  const [plan, setPlan] = useState<ReteachPlanResponse["plan"] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [oneClickFixLoading, setOneClickFixLoading] = useState(false);
  const [bulkFixLoading, setBulkFixLoading] = useState(false);
  const [planEditContent, setPlanEditContent] = useState("");
  const [planEditing, setPlanEditing] = useState(false);
  const [studentSummaryEdit, setStudentSummaryEdit] = useState("");
  const [studentSummarySaving, setStudentSummarySaving] = useState(false);

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
          setError(getApiClientErrorMessage(summaryResult.reason, "Failed to load report"));
        }
        if (insightsResult.status === "fulfilled" && insightsResult.value?.data?.ok) {
          setInsights(insightsResult.value.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, days]);

  useEffect(() => {
    if (!id) return;
    setPlanLoading(true);
    setPlanError(null);
    api
      .get<ReteachPlanResponse>(`/reports/lessons/${id}/reteach-plan`, { params: { days } })
      .then((res) => {
        if (res?.data?.ok && res.data.plan) setPlan(res.data.plan);
        else setPlan(null);
      })
      .catch((e) => {
        setPlan(null);
        if (getHttpStatus(e) !== 404) setPlanError(getApiClientErrorMessage(e, "Failed to load plan."));
      })
      .finally(() => setPlanLoading(false));
  }, [id, days]);

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
    <LessonImageLightboxProvider>
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem" }}>Lesson attempts</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <span style={{ color: "#6b7280", fontSize: "0.95rem" }}>Last</span>
        {([7, 14, 30] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: days === d ? "2px solid #2563eb" : "1px solid #e2e8f0",
              background: days === d ? "rgba(37,99,235,0.1)" : "white",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {d} days
          </button>
        ))}
      </div>
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

      {/* PR14: Reteach plan (uses same days selector as above) */}
      <div style={{ marginTop: 32, padding: 20, borderRadius: 12, border: "2px solid #e2e8f0", background: "#f8fafc" }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: "1.2rem" }}>Reteach plan</h2>
        {(() => {
          const hasPractice = (summary?.bySource?.practice ?? 0) > 0 || (insights?.items?.length ?? 0) > 0;
          if (!hasPractice) {
            return (
              <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                No attempts yet — reteach plan will appear after students practise.
              </p>
            );
          }
          if (planLoading && !plan) {
            return <p style={{ margin: 0, color: "#6b7280" }}>Loading plan…</p>;
          }
          if (planError) {
            return <p style={{ margin: 0, color: "#dc2626" }}>{planError}</p>;
          }
          if (!plan) {
            const firstTopicKey = insights?.topics?.[0]?.topicKey;
            return (
              <>
                <p style={{ margin: "0 0 12px 0", color: "#64748b", fontSize: 14 }}>
                  Generate a short reteach plan from top misconceptions (AI).
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={generateLoading}
                    onClick={async () => {
                      if (!id) return;
                      setGenerateLoading(true);
                      setPlanError(null);
                      try {
                        const res = await api.post<ReteachPlanResponse>(`/reports/lessons/${id}/reteach-plan`, {
                          days,
                          limit: 10,
                        });
                        if (res?.data?.ok && res.data.plan) {
                          setPlan(res.data.plan);
                          setPlanEditContent(res.data.plan.content);
                          setStudentSummaryEdit(res.data.plan.studentSummary ?? "");
                        }
                      } catch (e: any) {
                        setPlanError(e?.response?.data?.error || "Failed to generate plan.");
                      } finally {
                        setGenerateLoading(false);
                      }
                    }}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      border: "2px solid #10b981",
                      background: generateLoading ? "#e5e7eb" : "rgba(16,185,129,0.12)",
                      cursor: generateLoading ? "not-allowed" : "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#047857",
                    }}
                  >
                    {generateLoading ? "Generating…" : "Generate reteach plan"}
                  </button>
                  {firstTopicKey && (
                    <button
                      type="button"
                      disabled={oneClickFixLoading || generateLoading}
                      onClick={async () => {
                        if (!id) return;
                        setOneClickFixLoading(true);
                        setPlanError(null);
                        try {
                          const res = await api.post<{ ok: boolean; plan?: { id: string | null }; attach?: { added: number } }>(
                            `/reports/lessons/${id}/one-click-fix`,
                            { days, topicKey: firstTopicKey, attachByTopic: true, attachLimit: 10, regeneratePlan: true, planLimit: 10 }
                          );
                          if (res?.data?.ok) {
                            const planRes = await api.get<ReteachPlanResponse>(`/reports/lessons/${id}/reteach-plan`, { params: { days } });
                            if (planRes?.data?.ok && planRes.data.plan) {
                              setPlan(planRes.data.plan);
                              setPlanEditContent(planRes.data.plan.content);
                              setStudentSummaryEdit(planRes.data.plan.studentSummary ?? "");
                            }
                          }
                        } catch (e: any) {
                          setPlanError(getApiClientErrorMessage(e, "One-click fix failed."));
                        } finally {
                          setOneClickFixLoading(false);
                        }
                      }}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "2px solid #059669",
                        background: oneClickFixLoading ? "#e5e7eb" : "rgba(5,150,105,0.12)",
                        cursor: oneClickFixLoading ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "#047857",
                      }}
                    >
                      {oneClickFixLoading ? "Running…" : "Attach top 10 from worst topic + regenerate"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={bulkFixLoading || generateLoading || oneClickFixLoading}
                    onClick={async () => {
                      if (!id) return;
                      setBulkFixLoading(true);
                      setPlanError(null);
                      try {
                        const res = await api.post<{ ok: boolean; plan?: ReteachPlanResponse["plan"] }>(
                          `/reports/lessons/${id}/one-click-fix-bulk`,
                          { days, attachByTopic: true, attachLimitPerTopic: 10, regeneratePlan: true, planLimit: 10 }
                        );
                        if (res?.data?.ok) {
                          const planRes = await api.get<ReteachPlanResponse>(`/reports/lessons/${id}/reteach-plan`, { params: { days } });
                          if (planRes?.data?.ok && planRes.data.plan) {
                            setPlan(planRes.data.plan);
                            setPlanEditContent(planRes.data.plan.content);
                            setStudentSummaryEdit(planRes.data.plan.studentSummary ?? "");
                          }
                        }
                      } catch (e: any) {
                        setPlanError(getApiClientErrorMessage(e, "Bulk fix failed."));
                      } finally {
                        setBulkFixLoading(false);
                      }
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "2px solid #0d9488",
                      background: bulkFixLoading ? "#e5e7eb" : "rgba(13,148,136,0.12)",
                      cursor: bulkFixLoading ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                      color: "#0f766e",
                    }}
                  >
                    {bulkFixLoading ? "Running…" : "Fix top hotspots + regenerate"}
                  </button>
                </div>
              </>
            );
          }
          return (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPlanEditing(!planEditing);
                    if (!planEditing) setPlanEditContent(plan.content);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #64748b",
                    background: "#f1f5f9",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {planEditing ? "Cancel" : "Edit"}
                </button>
                {planEditing && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!id) return;
                      try {
                        const res = await api.patch<ReteachPlanResponse>(`/reports/lessons/${id}/reteach-plan`, {
                          content: planEditContent,
                        });
                        if (res?.data?.ok && res.data.plan) {
                          setPlan(res.data.plan);
                          setPlanEditing(false);
                        }
                      } catch {}
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "2px solid #10b981",
                      background: "rgba(16,185,129,0.12)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#047857",
                    }}
                  >
                    Save
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!id) return;
                    try {
                      const res = await api.patch<ReteachPlanResponse>(`/reports/lessons/${id}/reteach-plan`, {
                        pinned: !plan.pinned,
                      });
                      if (res?.data?.ok && res.data.plan) setPlan(res.data.plan);
                    } catch {}
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: plan.pinned ? "2px solid #f59e0b" : "1px solid #e2e8f0",
                    background: plan.pinned ? "rgba(245,158,11,0.12)" : "#f9fafb",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: plan.pinned ? "#b45309" : "#374151",
                  }}
                >
                  {plan.pinned ? "Pinned" : "Pin"}
                </button>
              </div>
              {/* PR15: Student next steps (shown to students at end of lesson) */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1rem", fontWeight: 700 }}>Student next steps</h3>
                <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#64748b" }}>
                  Shown to subscribed/unlocked students at the end of the lesson.
                </p>
                <textarea
                  value={studentSummaryEdit}
                  onChange={(e) => setStudentSummaryEdit(e.target.value.slice(0, 1000))}
                  maxLength={1000}
                  placeholder="e.g. Review mitosis diagrams and try the practice questions again."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    fontFamily: "inherit",
                  }}
                />
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{studentSummaryEdit.length}/1000</div>
                <button
                  type="button"
                  disabled={studentSummarySaving}
                  onClick={async () => {
                    if (!id) return;
                    setStudentSummarySaving(true);
                    try {
                      const res = await api.patch<ReteachPlanResponse>(`/reports/lessons/${id}/reteach-plan`, {
                        studentSummary: studentSummaryEdit.trim().slice(0, 1000),
                      });
                      if (res?.data?.ok && res.data.plan) {
                        setPlan(res.data.plan);
                      }
                    } finally {
                      setStudentSummarySaving(false);
                    }
                  }}
                  style={{
                    marginTop: 8,
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: "2px solid #10b981",
                    background: studentSummarySaving ? "#e5e7eb" : "rgba(16,185,129,0.12)",
                    cursor: studentSummarySaving ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#047857",
                  }}
                >
                  {studentSummarySaving ? "Saving…" : "Save"}
                </button>
              </div>
              {planEditing ? (
                <textarea
                  value={planEditContent}
                  onChange={(e) => setPlanEditContent(e.target.value)}
                  rows={14}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "white",
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: "#374151",
                  }}
                >
                  <LessonMarkdown className="lesson-md-body" urlTransform={lessonMarkdownUrlTransform}>
                    {preprocessMarkdownAssetUrls(plan.content)}
                  </LessonMarkdown>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
    </LessonImageLightboxProvider>
  );
}
