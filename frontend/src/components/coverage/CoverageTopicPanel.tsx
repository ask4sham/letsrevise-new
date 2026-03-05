/**
 * PR-013: Coverage drill-down panel — missing spec, lessons, weak questions, quick actions.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCoverageDrilldown, type CoverageDrilldownResponse } from "../../api/coverageDrilldown";
import type { CoverageRow } from "../../api/coverage";
import type { SpecKey } from "../../api/taxonomy";

type Props = {
  topicKey: string;
  specKey: SpecKey | string;
  windowDays: number;
  row: CoverageRow;
  onClose: () => void;
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#2563eb" : "#dc2626";
  return (
    <div style={{ width: 80, height: 10, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
    </div>
  );
}

export const CoverageTopicPanel: React.FC<Props> = ({ topicKey, specKey, windowDays, row, onClose }) => {
  const [data, setData] = useState<CoverageDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCoverageDrilldown({ specKey, topicKey, windowDays })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? "Failed to load drill-down");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [specKey, topicKey, windowDays]);

  const createLessonUrl = (statementCode?: string) => {
    const params = new URLSearchParams({ topicKey });
    if (statementCode) params.set("statementCode", statementCode);
    return `/create-lesson?${params.toString()}`;
  };

  const segment = topicKey.includes(":") ? topicKey.split(":").slice(-1)[0] : topicKey;
  const displayTitle = segment ? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "min(480px, 100vw)",
        height: "100vh",
        background: "white",
        boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700 }}>{displayTitle}</h2>
          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>{topicKey}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: row.status === "STRONG" ? "#d1fae5" : row.status === "OK" ? "#dbeafe" : "#fef3c7",
                color: row.status === "STRONG" ? "#047857" : row.status === "OK" ? "#1d4ed8" : "#a16207",
              }}
            >
              {row.status}
            </span>
            <ScoreBar score={row.score} />
            <span style={{ fontSize: 12 }}>{row.score}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            color: "#6b7280",
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

        {data && (
          <>
            {/* Section 1 — Missing spec statements */}
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                Missing spec statements ({data.specStatements.missing.length})
              </h3>
              {data.specStatements.missing.length === 0 ? (
                <p style={{ fontSize: 13, color: "#059669" }}>All spec statements have knowledge documents.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {data.specStatements.missing.map((m) => (
                    <li key={m.statementCode} style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{m.statementCode}</span> — {m.statementText}
                      <div style={{ marginTop: 4 }}>
                        <Link
                          to={createLessonUrl(m.statementCode)}
                          style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}
                        >
                          Create lesson covering this statement →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Section 2 — Lessons contributing knowledge */}
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                Lessons contributing knowledge ({data.lessons.length})
              </h3>
              {data.lessons.length === 0 ? (
                <p style={{ fontSize: 13, color: "#6b7280" }}>No lessons indexed for this topic.</p>
              ) : (
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: "8px 0" }}>Lesson</th>
                      <th style={{ textAlign: "right", padding: "8px 0" }}>Docs</th>
                      <th style={{ textAlign: "left", padding: "8px 0" }}>Updated</th>
                      <th style={{ textAlign: "center", padding: "8px 0" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lessons.map((l) => (
                      <tr key={l.lessonId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "8px 0" }}>{l.title}</td>
                        <td style={{ textAlign: "right", padding: "8px 0" }}>{l.knowledgeDocs}</td>
                        <td style={{ padding: "8px 0", fontSize: 12, color: "#6b7280" }}>
                          {l.lastUpdated ? new Date(l.lastUpdated).toLocaleDateString() : "-"}
                        </td>
                        <td style={{ padding: "8px 0", textAlign: "center" }}>
                          <Link
                            to={`/edit-lesson/${l.lessonId}`}
                            style={{ marginRight: 8, fontSize: 12, color: "#2563eb" }}
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/lesson/${l.lessonId}`}
                            style={{ fontSize: 12, color: "#2563eb" }}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Section 3 — Weak student questions */}
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                Weak student questions ({data.weakQuestions.length})
              </h3>
              {data.weakQuestions.length === 0 ? (
                <p style={{ fontSize: 13, color: "#6b7280" }}>No weak-evidence enquiries in window.</p>
              ) : (
                <>
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                        <th style={{ textAlign: "left", padding: "8px 0" }}>Question</th>
                        <th style={{ textAlign: "right", padding: "8px 0" }}>enquiries</th>
                        <th style={{ textAlign: "right", padding: "8px 0" }}>weak rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.weakQuestions.map((q, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "8px 0" }}>&quot;{q.question.slice(0, 80)}{q.question.length > 80 ? "…" : ""}&quot;</td>
                          <td style={{ textAlign: "right", padding: "8px 0" }}>{q.enquiries}</td>
                          <td style={{ textAlign: "right", padding: "8px 0" }}>{q.weakRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                    Open a lesson for this topic and use Ask AI to test these questions.
                  </p>
                </>
              )}
            </section>

            {/* Section 4 — Quick actions */}
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>Quick actions</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link
                  to={createLessonUrl()}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    background: "#10b981",
                    color: "white",
                    borderRadius: 8,
                    textAlign: "center",
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  Create lesson for this topic
                </Link>
                <Link
                  to={`/teacher/questions?topicKey=${encodeURIComponent(topicKey)}`}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    background: "white",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    textAlign: "center",
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  Open question bank (filtered by topic)
                </Link>
                <Link
                  to={`/teacher/topic-banks/flashcards?topicKey=${encodeURIComponent(topicKey)}`}
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    background: "white",
                    color: "#374151",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    textAlign: "center",
                    fontWeight: 600,
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  Open flashcard bank (filtered by topic)
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
