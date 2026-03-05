/**
 * PR-013: Coverage topic detail drawer — spec coverage, lessons, weak questions, quick actions.
 * PR-014: Generate starter pack (draft) action.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCoverageDrilldown, type CoverageDrilldownResponse } from "../../api/coverageDrilldown";
import { getSprintOrderMarkdown } from "../../api/sprintOrder";
import { postGenerateStarterPack, type StarterPackResponse } from "../../api/generation";
import type { CoverageRow } from "../../api/coverage";
import type { SpecKey } from "../../api/taxonomy";

type Props = {
  open: boolean;
  onClose: () => void;
  specKey: SpecKey | string;
  topicKey: string;
  windowDays: number;
  row?: CoverageRow | null;
  onAskAi?: (question: string) => void;
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

export const CoverageTopicDrawer: React.FC<Props> = ({
  open,
  onClose,
  specKey,
  topicKey,
  windowDays,
  row,
  onAskAi,
}) => {
  const [data, setData] = useState<CoverageDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<StarterPackResponse | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [showGenConfirm, setShowGenConfirm] = useState(false);

  useEffect(() => {
    if (!open || !topicKey?.trim()) return;
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
  }, [open, specKey, topicKey, windowDays]);

  const handleCopyTopicKey = () => {
    navigator.clipboard.writeText(topicKey);
    setCopyToast("topicKey copied");
    setTimeout(() => setCopyToast(null), 2000);
  };

  const handleAskAi = (question: string) => {
    if (onAskAi) {
      onAskAi(question);
      onClose();
    } else {
      navigator.clipboard.writeText(question);
      setCopyToast("Question copied—paste into Ask AI");
      setTimeout(() => setCopyToast(null), 2500);
    }
  };

  const handleDownloadSprintOrder = async () => {
    setSprintLoading(true);
    try {
      const { source } = await getSprintOrderMarkdown({
        specKey,
        windowDays,
        useSnapshots: true,
        top: 200,
        minEnquiries: 3,
      });
      setCopyToast(`Downloaded sprint order (${source})`);
      setTimeout(() => setCopyToast(null), 3000);
    } catch (e: any) {
      setCopyToast(e?.message ?? "Download failed");
      setTimeout(() => setCopyToast(null), 3000);
    } finally {
      setSprintLoading(false);
    }
  };

  const handleGenerateStarterPack = async () => {
    setShowGenConfirm(false);
    setGenLoading(true);
    setGenError(null);
    setGenResult(null);
    try {
      const statementCodes = data?.specStatements?.missing?.slice(0, 3).map((m) => m.statementCode).filter(Boolean) ?? [];
      const res = await postGenerateStarterPack({
        specKey,
        topicKey,
        statementCodes: statementCodes.length > 0 ? statementCodes : undefined,
      });
      setGenResult(res);
    } catch (e: any) {
      setGenError(e?.response?.data?.message ?? e?.message ?? "Generation failed");
    } finally {
      setGenLoading(false);
    }
  };

  const createLessonUrl = (statementCode?: string) => {
    const params = new URLSearchParams({ topicKey });
    if (statementCode) params.set("statementCode", statementCode);
    return `/create-lesson?${params.toString()}`;
  };

  const segment = topicKey.includes(":") ? topicKey.split(":").slice(-1)[0] : topicKey;
  const displayTitle = segment ? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 999,
        }}
        onClick={onClose}
        aria-hidden="true"
      />
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{displayTitle}</h2>
              <button
                type="button"
                onClick={handleCopyTopicKey}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#6b7280",
                  padding: 2,
                }}
                title="Copy topicKey"
              >
                📋
              </button>
            </div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>{topicKey}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Window: {windowDays} days</div>
            {row && (
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
            )}
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
          {copyToast && (
            <div
              style={{
                padding: "8px 12px",
                marginBottom: 12,
                background: "#d1fae5",
                color: "#065f46",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {copyToast}
            </div>
          )}

          {loading && (
            <div style={{ color: "#6b7280" }}>
              <div style={{ height: 20, background: "#f3f4f6", borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 80, background: "#f3f4f6", borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 60, background: "#f3f4f6", borderRadius: 4 }} />
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  getCoverageDrilldown({ specKey, topicKey, windowDays })
                    .then(setData)
                    .catch((e: any) => setError(e?.message ?? "Failed"))
                    .finally(() => setLoading(false));
                }}
                style={{
                  padding: "8px 16px",
                  background: "#374151",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Retry
              </button>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Section 1 — Spec statements */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                  Spec statements — {data.specStatements.indexed}/{data.specStatements.total} indexed,{" "}
                  {data.specStatements.missing.length} missing
                </h3>
                {data.specStatements.missing.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#059669" }}>All spec statements have knowledge documents.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.specStatements.missing.map((m) => (
                      <li key={m.statementCode || m._id || Math.random()} style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.statementCode}</span> — {m.statementText}
                        <div style={{ marginTop: 4 }}>
                          <Link
                            to={createLessonUrl(m.statementCode)}
                            style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}
                          >
                            Create lesson for this statement →
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <Link
                    to={createLessonUrl()}
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      background: "#10b981",
                      color: "white",
                      borderRadius: 8,
                      fontWeight: 600,
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    Create lesson for this topic
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowGenConfirm(true)}
                    disabled={genLoading}
                    style={{
                      padding: "8px 16px",
                      background: "#6366f1",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: genLoading ? "wait" : "pointer",
                    }}
                  >
                    {genLoading ? "Generating…" : "Generate starter pack (draft)"}
                  </button>
                </div>
              </section>

              {/* PR-014: Generate starter pack confirmation modal */}
              {showGenConfirm && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    zIndex: 1100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                  onClick={() => setShowGenConfirm(false)}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: 24,
                      maxWidth: 420,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Generate starter pack</h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563" }}>
                      Creates a draft lesson + draft flashcards, quiz questions, and exam questions. Nothing is published.
                      Uses top missing spec statements when none are selected.
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setShowGenConfirm(false)}
                        style={{
                          padding: "8px 16px",
                          background: "#e5e7eb",
                          color: "#374151",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateStarterPack}
                        style={{
                          padding: "8px 16px",
                          background: "#6366f1",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PR-014: Success panel with links */}
              {genResult && (
                <section style={{ marginBottom: 24, padding: 16, background: "#d1fae5", borderRadius: 12 }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#065f46" }}>
                    Starter pack created
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#047857" }}>
                    Job ID: {genResult.jobId}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Link
                      to={`/edit-lesson/${genResult.outputs.lessonId}`}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Edit draft lesson →
                    </Link>
                    <Link
                      to={genResult.links.flashcardsBank}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Review draft flashcards ({genResult.outputs.flashcardIdsCount})
                    </Link>
                    <Link
                      to={genResult.links.quizBank}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Review draft quiz ({genResult.outputs.quizCount})
                    </Link>
                    <Link
                      to={genResult.links.examBank}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Review draft exam questions ({genResult.outputs.examCount})
                    </Link>
                  </div>
                </section>
              )}

              {genError && (
                <section style={{ marginBottom: 24, padding: 12, background: "#fee2e2", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{genError}</p>
                </section>
              )}

              {/* Section 2 — Lessons */}
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
                            <Link to={l.links.student} style={{ marginRight: 8, fontSize: 12, color: "#2563eb" }}>
                              View
                            </Link>
                            <Link to={l.links.edit} style={{ fontSize: 12, color: "#2563eb" }}>
                              Edit
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* Section 3 — Weak questions */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                  Weak questions ({data.weakQuestions.length})
                </h3>
                {data.weakQuestions.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#6b7280" }}>No weak-evidence enquiries in window.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.weakQuestions.map((q, i) => (
                      <li key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                        &quot;{q.question.slice(0, 100)}{q.question.length > 100 ? "…" : ""}&quot; ({q.enquiries})
                        <button
                          type="button"
                          onClick={() => handleAskAi(q.question)}
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            fontSize: 11,
                            background: "#6366f1",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Ask AI
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Section 4 — Sprint */}
              <section>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>Sprint</h3>
                <button
                  type="button"
                  onClick={handleDownloadSprintOrder}
                  disabled={sprintLoading}
                  style={{
                    padding: "10px 16px",
                    background: "#6366f1",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: sprintLoading ? "wait" : "pointer",
                    fontSize: 14,
                  }}
                >
                  {sprintLoading ? "Downloading…" : "Download sprint order"}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
};
