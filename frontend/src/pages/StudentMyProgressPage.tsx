/**
 * PR-STU-PROGRESS-1: Student "My Progress" — reflection (quizzes attempted, avg score, needs practice).
 * Phase 2: Extended with canonical mastery from LearningEvidenceEvent (GET /api/student/dashboard).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getStudentProgress,
  type SubjectProgress,
  type TopicProgress,
  type StudentProgressResponse,
} from "../api/studentProgress";
import {
  getStudentDashboard,
  type DashboardResponse,
  type TopicEvidence,
  type StudyPlanItem,
} from "../api/studentDashboard";
import { getTopicRevisionAction } from "../utils/topicRevisionAction";

const DEFAULT_SPEC = "aqa-gcse-biology";

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

function SubjectBadge({ averageScore }: { averageScore: number | null }) {
  if (averageScore == null) return <span style={{ color: "#9ca3af", fontSize: 12 }}>—</span>;
  if (averageScore < 0.4) {
    return (
      <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
        Needs practice
      </span>
    );
  }
  return (
    <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
      On track
    </span>
  );
}

function TopicStatusBadge({ topic }: { topic: TopicProgress }) {
  if (!topic.attempted) {
    return (
      <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#f3f4f6", color: "#6b7280", fontWeight: 500 }}>
        Not started
      </span>
    );
  }
  if (topic.needsPractice) {
    return (
      <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
        Needs practice
      </span>
    );
  }
  return (
    <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
      On track
    </span>
  );
}

function topicKeyToTitle(topicKey: string): string {
  const last = (topicKey || "").split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey || "";
}

function DifficultyBadge({ level }: { level: string }) {
  const l = (level || "unknown").toLowerCase();
  const style =
    l === "well_understood"
      ? { background: "#d1fae5", color: "#065f46" }
      : l === "moderate"
      ? { background: "#fef3c7", color: "#92400e" }
      : l === "difficult" || l === "very_difficult"
      ? { background: "#fee2e2", color: "#991b1b" }
      : { background: "#f3f4f6", color: "#6b7280" };
  const label =
    l === "well_understood"
      ? "Well understood"
      : l === "moderate"
      ? "Moderate"
      : l === "difficult"
      ? "Difficult"
      : l === "very_difficult"
      ? "Very difficult"
      : "—";
  return (
    <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, ...style }}>
      {label}
    </span>
  );
}

export default function StudentMyProgressPage() {
  const navigate = useNavigate();
  const [progressData, setProgressData] = useState<StudentProgressResponse | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useCanonicalMastery, setUseCanonicalMastery] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dash = await getStudentDashboard({ specKey: DEFAULT_SPEC, days: 14, limit: 6 });
      if (dash?.ok && dash.specEvidence?.topics?.length !== undefined) {
        setDashboardData(dash);
        setUseCanonicalMastery(true);
        setProgressData(null);
      } else {
        throw new Error("No spec evidence");
      }
    } catch {
      try {
        const res = await getStudentProgress();
        setProgressData(res);
        setDashboardData(null);
        setUseCanonicalMastery(false);
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const studyPlanMap = React.useMemo(() => {
    const map = new Map<string, StudyPlanItem>();
    (dashboardData?.studyPlan?.plan ?? []).forEach((p) => {
      const key = (p.topicKey || "").toLowerCase().replace(/^[^:]+:/, "");
      map.set(key, p);
    });
    return map;
  }, [dashboardData?.studyPlan?.plan]);

  const hasCanonicalData = useCanonicalMastery && dashboardData?.specEvidence?.topics;
  const hasLegacyData = progressData && (progressData.subjects?.[0]?.quizzesAttempted ?? 0) > 0;
  const hasAnyAttempts = hasCanonicalData
    ? (dashboardData!.specEvidence!.topics ?? []).some(
        (t) => (t.quizStats?.attempts ?? 0) + (t.examStats?.attempts ?? 0) > 0
      )
    : hasLegacyData;

  const canonicalTopics = React.useMemo(() => {
    if (!dashboardData?.specEvidence?.topics) return [];
    const topics = [...dashboardData.specEvidence.topics];
    topics.sort((a, b) => {
      const scoreA = a.derivedMetrics?.masteryScore ?? 101;
      const scoreB = b.derivedMetrics?.masteryScore ?? 101;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return (a.topicKey || "").localeCompare(b.topicKey || "");
    });
    return topics;
  }, [dashboardData?.specEvidence?.topics]);

  const canonicalOverall = React.useMemo(() => {
    if (!dashboardData?.specEvidence?.topics) return null;
    const topics = dashboardData.specEvidence.topics;
    let totalQuiz = 0;
    let totalQuizCorrect = 0;
    let totalExam = 0;
    let totalExamCorrect = 0;
    for (const t of topics) {
      totalQuiz += t.quizStats?.attempts ?? 0;
      totalQuizCorrect += t.quizStats?.correct ?? 0;
      totalExam += t.examStats?.attempts ?? 0;
      totalExamCorrect += t.examStats?.correct ?? 0;
    }
    const totalAttempts = totalQuiz + totalExam;
    const totalCorrect = totalQuizCorrect + totalExamCorrect;
    const avg = totalAttempts > 0 ? totalCorrect / totalAttempts : null;
    return {
      subject: "Biology",
      quizzesAttempted: totalAttempts,
      averageScore: avg,
      lastActivityAt: dashboardData.recentActivity?.[0]?.createdAt ?? null,
    };
  }, [dashboardData?.specEvidence?.topics, dashboardData?.recentActivity]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/student-dashboard" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>

      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.65rem" }}>My Progress</h1>
      <p style={{ margin: "0 0 24px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        See how you&apos;re doing and where to practise next.
      </p>

      {loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {!loading && !error && !hasAnyAttempts && (
        <div
          style={{
            padding: 32,
            background: "#f9fafb",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#6b7280", margin: "0 0 20px 0", fontSize: 15 }}>
            You haven&apos;t attempted any quizzes yet.
            <br />
            Once you start, your progress will appear here.
          </p>
          <Link
            to="/browse-lessons"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Browse lessons
          </Link>
        </div>
      )}

      {!loading && !error && hasAnyAttempts && (
        <>
          {useCanonicalMastery && (dashboardData?.overdueTopics?.length ?? 0) > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 12px 0", fontSize: "1.15rem", color: "#b91c1c" }}>Overdue review</h2>
              <div style={{ padding: 12, background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca" }}>
                {dashboardData.overdueTopics.slice(0, 3).map((t) => {
                  const action = getTopicRevisionAction({ masteryScore: t.masteryScore, topicKey: t.topicKey });
                  return (
                    <div key={t.topicKey} style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#991b1b" }}>{t.topicName}</span>
                      <span style={{ fontSize: 12, color: "#b91c1c" }}>{t.reason}</span>
                      <button
                        type="button"
                        onClick={() => navigate(action.route)}
                        style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#dc2626", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
                      >
                        {action.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {useCanonicalMastery && (dashboardData?.dueToday?.length ?? 0) > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 12px 0", fontSize: "1.15rem", color: "#b45309" }}>Due today</h2>
              <div style={{ padding: 12, background: "#fffbeb", borderRadius: 10, border: "1px solid #fde68a" }}>
                {dashboardData.dueToday.slice(0, 3).map((t) => {
                  const action = getTopicRevisionAction({ masteryScore: t.masteryScore, topicKey: t.topicKey });
                  return (
                    <div key={t.topicKey} style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#92400e" }}>{t.topicName}</span>
                      <span style={{ fontSize: 12, color: "#b45309" }}>{t.reason}</span>
                      <button
                        type="button"
                        onClick={() => navigate(action.route)}
                        style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#d97706", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
                      >
                        {action.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {useCanonicalMastery && dashboardData?.studyPlan?.plan && dashboardData.studyPlan.plan.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ margin: "0 0 12px 0", fontSize: "1.25rem" }}>Recommended next</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                {dashboardData.studyPlan.plan.slice(0, 3).map((p) => {
                  const action = getTopicRevisionAction({
                    masteryScore: p.masteryScore ?? null,
                    topicKey: p.topicKey,
                  });
                  return (
                    <div
                      key={p.topicKey}
                      style={{
                        padding: 16,
                        background: "#f0fdf4",
                        borderRadius: 12,
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <strong style={{ display: "block", marginBottom: 4, color: "#166534" }}>
                        {topicKeyToTitle(p.topicKey)}
                      </strong>
                      <p style={{ margin: "0 0 4px 0", fontSize: 13, color: "#166534" }}>
                        Mastery: {p.masteryScore ?? 0}%
                      </p>
                      {p.reason && (
                        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#15803d", fontStyle: "italic" }}>
                          {p.reason}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(action.route)}
                        style={{
                          padding: "8px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          background: "#22c55e",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        {action.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "1.25rem" }}>Overall</h2>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thTdStyle}>Subject</th>
                    <th style={thTdStyle}>Attempts</th>
                    <th style={thTdStyle}>Average score</th>
                    <th style={thTdStyle}>Last activity</th>
                    <th style={thTdStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {useCanonicalMastery && canonicalOverall ? (
                    <tr>
                      <td style={thTdStyle}>{canonicalOverall.subject}</td>
                      <td style={thTdStyle}>{canonicalOverall.quizzesAttempted}</td>
                      <td style={thTdStyle}>
                        {canonicalOverall.averageScore != null
                          ? `${(canonicalOverall.averageScore * 100).toFixed(0)}%`
                          : "—"}
                      </td>
                      <td style={thTdStyle}>
                        {canonicalOverall.lastActivityAt
                          ? new Date(canonicalOverall.lastActivityAt).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td style={thTdStyle}>
                        <SubjectBadge averageScore={canonicalOverall.averageScore} />
                      </td>
                    </tr>
                  ) : (
                    (progressData?.subjects ?? []).map((s: SubjectProgress, i: number) => (
                      <tr key={i}>
                        <td style={thTdStyle}>{s.subject}</td>
                        <td style={thTdStyle}>{s.quizzesAttempted}</td>
                        <td style={thTdStyle}>
                          {s.averageScore != null ? `${(s.averageScore * 100).toFixed(0)}%` : "—"}
                        </td>
                        <td style={thTdStyle}>
                          {s.lastActivityAt
                            ? new Date(s.lastActivityAt).toLocaleDateString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td style={thTdStyle}>
                          <SubjectBadge averageScore={s.averageScore} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ margin: "0 0 16px 0", fontSize: "1.25rem" }}>
              By topic {useCanonicalMastery && "(canonical mastery)"}
            </h2>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thTdStyle}>Topic</th>
                    {useCanonicalMastery && <th style={thTdStyle}>Mastery</th>}
                    {useCanonicalMastery && <th style={thTdStyle}>Difficulty</th>}
                    <th style={thTdStyle}>{useCanonicalMastery ? "Attempts" : "Attempted"}</th>
                    {!useCanonicalMastery && <th style={thTdStyle}>Avg score</th>}
                    <th style={thTdStyle}>Status</th>
                    <th style={thTdStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {useCanonicalMastery && hasCanonicalData
                    ? canonicalTopics.map((t: TopicEvidence) => {
                        const quizAttempts = t.quizStats?.attempts ?? 0;
                        const examAttempts = t.examStats?.attempts ?? 0;
                        const totalAttempts = quizAttempts + examAttempts;
                        const hasAttempts = totalAttempts > 0;
                        const mastery = t.derivedMetrics?.masteryScore ?? null;
                        const needsPractice = mastery !== null && mastery < 70;
                        const topicSlug = (t.topicKey || "").split(":").pop()?.toLowerCase() ?? "";
                        const planItem = studyPlanMap.get(topicSlug);
                        return (
                          <tr key={t.topicKey}>
                            <td style={thTdStyle}>{topicKeyToTitle(t.topicKey)}</td>
                            <td style={thTdStyle}>
                              {mastery != null ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div
                                    style={{
                                      flex: 1,
                                      minWidth: 60,
                                      height: 8,
                                      background: "#e5e7eb",
                                      borderRadius: 4,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${Math.min(100, Math.max(0, mastery))}%`,
                                        height: "100%",
                                        background:
                                          mastery < 40
                                            ? "#ef4444"
                                            : mastery < 70
                                            ? "#f97316"
                                            : mastery < 85
                                            ? "#22c55e"
                                            : "#3b82f6",
                                        borderRadius: 4,
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontSize: 13, minWidth: 36 }}>{mastery}%</span>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={thTdStyle}>
                              <DifficultyBadge level={t.derivedMetrics?.difficultyLevel ?? "unknown"} />
                            </td>
                            <td style={thTdStyle}>
                              {hasAttempts
                                ? `Quiz: ${quizAttempts}, Exam: ${examAttempts}`
                                : "—"}
                            </td>
                            <td style={thTdStyle}>
                              {!hasAttempts ? (
                                <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#f3f4f6", color: "#6b7280" }}>
                                  Not started
                                </span>
                              ) : needsPractice ? (
                                <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
                                  Needs practice
                                </span>
                              ) : (
                                <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, background: "#d1fae5", color: "#065f46", fontWeight: 600 }}>
                                  On track
                                </span>
                              )}
                            </td>
                            <td style={thTdStyle}>
                              {(() => {
                                const action = getTopicRevisionAction({
                                  masteryScore: mastery,
                                  difficulty: t.derivedMetrics?.difficultyLevel,
                                  attempts: totalAttempts,
                                  topicKey: t.topicKey || "",
                                });
                                return (
                                  <button
                                    type="button"
                                    onClick={() => navigate(action.route)}
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: 13,
                                      fontWeight: 600,
                                      background: action.type === "review" ? "#e0e7ff" : "#2563eb",
                                      color: action.type === "review" ? "#3730a3" : "white",
                                      border: "none",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {action.label}
                                  </button>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    : (progressData?.topics ?? []).map((t: TopicProgress) => {
                        const legacyMastery = t.averageScore != null ? t.averageScore * 100 : 0;
                        const legacyAction = getTopicRevisionAction({
                          masteryScore: legacyMastery,
                          topicKey: t.topicKey || "",
                        });
                        return (
                          <tr key={t.topicKey}>
                            <td style={thTdStyle}>{t.topicName}</td>
                            <td style={thTdStyle}>{t.attempted ? "Yes" : "No"}</td>
                            <td style={thTdStyle}>
                              {t.averageScore != null ? `${(t.averageScore * 100).toFixed(0)}%` : "—"}
                            </td>
                            <td style={thTdStyle}>
                              <TopicStatusBadge topic={t} />
                            </td>
                            <td style={thTdStyle}>
                              <button
                                type="button"
                                onClick={() => navigate(legacyAction.route)}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  background: legacyAction.type === "review" ? "#e0e7ff" : "#2563eb",
                                  color: legacyAction.type === "review" ? "#3730a3" : "white",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                }}
                              >
                                {legacyAction.label}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
