/**
 * Admin Content Coverage page — spec-level topic coverage from content graph.
 * Route: /admin/content-coverage
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchSpecCoverage,
  fetchSpecGaps,
  rebuildTopicGraph,
  rebuildSpecGraph,
  type TopicCoverageRow,
  type SpecCoverageResponse,
  type TopicGap,
  type SpecGapsResponse,
} from "../api/contentGraph";
import { setStoredSpecKey } from "../utils/specKey";
import Toast from "../components/Toast";

/** Resolve topicKey for URL/state: prefer namespaced specKey:topicKey when topicKey is short. */
function resolveTopicKey(gap: TopicGap): string {
  const tk = gap.topicKey || "";
  const sk = gap.specKey || "";
  if (!tk) return "";
  if (tk.includes(":")) return tk;
  return sk ? `${sk}:${tk}` : tk;
}

export type SuggestedAction = { type: string; label: string; reason: string };

/** Map a suggested action to navigation target. Returns path and optional state. */
export function mapSuggestedActionToNavigation(
  action: SuggestedAction,
  gap: TopicGap
): { path: string; state?: object } {
  const topicKey = resolveTopicKey(gap);
  const specKey = gap.specKey || "";

  switch (action.type) {
    case "create_lesson":
      return {
        path: "/create-lesson",
        state: { specKey, topicKey },
      };
    case "generate_flashcards":
      return {
        path: `/teacher/topic-banks/flashcards?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}`,
      };
    case "generate_quiz":
      return {
        path: `/teacher/topic-banks/quizzes?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}`,
      };
    case "generate_exam_questions":
      return {
        path: `/admin/question-banks?tab=exam-questions&topicKey=${encodeURIComponent(topicKey)}`,
      };
    case "review_content":
      return { path: "/admin/content-issues" };
    case "fix_mapping":
      return { path: "/admin/taxonomy" };
    default:
      return { path: "/admin" };
  }
}

type ViewMode = "coverage" | "gaps";

const SPEC_OPTIONS: { value: string; label: string }[] = [
  { value: "aqa-gcse-biology", label: "AQA GCSE Biology" },
  { value: "aqa-gcse-chemistry", label: "AQA GCSE Chemistry" },
  { value: "aqa-gcse-physics", label: "AQA GCSE Physics" },
  { value: "aqa-gcse-maths-foundation", label: "AQA GCSE Maths (Foundation)" },
  { value: "aqa-gcse-maths-higher", label: "AQA GCSE Maths (Higher)" },
  { value: "aqa-gcse-english-language", label: "AQA GCSE English Language" },
  { value: "aqa-gcse-english-literature", label: "AQA GCSE English Literature" },
];

function formatTopicKey(key: string): string {
  const part = key.includes(":") ? key.split(":").pop()! : key;
  return part.replace(/-/g, " ");
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "strong"
      ? { background: "#d4edda", color: "#155724" }
      : status === "partial"
      ? { background: "#fff3cd", color: "#856404" }
      : { background: "#f8d7da", color: "#721c24" };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        ...style,
      }}
    >
      {status}
    </span>
  );
}

function GapFlagsBadges({ gapFlags }: { gapFlags: TopicGap["gapFlags"] }) {
  const active = Object.entries(gapFlags || {}).filter(([, v]) => v);
  if (active.length === 0) return <span style={{ color: "#64748b", fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {active.map(([k]) => (
        <span
          key={k}
          style={{
            padding: "2px 6px",
            background: "#fef3c7",
            color: "#92400e",
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()}
        </span>
      ))}
    </div>
  );
}

const ContentCoveragePage: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("coverage");
  const [specKey, setSpecKey] = useState("aqa-gcse-biology");
  const [data, setData] = useState<SpecCoverageResponse | null>(null);
  const [gapsData, setGapsData] = useState<SpecGapsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicCoverageRow | null>(null);
  const [selectedGap, setSelectedGap] = useState<TopicGap | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildingSpec, setRebuildingSpec] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [rebuildToast, setRebuildToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadSpecCoverage = useCallback(async (): Promise<SpecCoverageResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpecCoverage(specKey);
      setData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load spec coverage");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  const loadSpecGaps = useCallback(async (): Promise<SpecGapsResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpecGaps(specKey);
      setGapsData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load gap analysis");
      setGapsData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  useEffect(() => {
    if (viewMode === "coverage") loadSpecCoverage();
    else loadSpecGaps();
  }, [viewMode, loadSpecCoverage, loadSpecGaps]);

  const openDrawer = (topic: TopicCoverageRow) => {
    setSelectedTopic(topic);
    setSelectedGap(null);
    setDrawerOpen(true);
  };

  const openGapDrawer = (gap: TopicGap) => {
    setSelectedGap(gap);
    setSelectedTopic(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTopic(null);
    setSelectedGap(null);
  };

  const handleRebuildTopic = async () => {
    if (!selectedTopic) return;
    const s = selectedTopic.specKey || specKey;
    const t = selectedTopic.topicKey || "";
    if (!s || !t) return;
    setRebuilding(true);
    setRebuildToast(null);
    try {
      await rebuildTopicGraph(s, t);
      const newData = await loadSpecCoverage();
      const updated = newData?.topics.find(
        (x) => (x.topicKey || "") === t && (x.specKey || "") === s
      );
      if (updated) setSelectedTopic(updated);
      setRebuildToast({ message: "Topic graph rebuilt successfully", type: "success" });
    } catch (err: any) {
      setRebuildToast({ message: err?.message || "Rebuild failed", type: "error" });
    } finally {
      setRebuilding(false);
    }
  };

  const handleRebuildSpec = async () => {
    setRebuildingSpec(true);
    setRebuildToast(null);
    try {
      const result = await rebuildSpecGraph(specKey);
      setRebuildToast({
        message: `Rebuilt ${result.topicsRebuilt} topics. ${result.lessonLinksCreated} lesson links, ${result.flashcardLinksCreated} flashcard links.`,
        type: "success",
      });
      await loadSpecCoverage();
      if (viewMode === "gaps") await loadSpecGaps();
    } catch (err: any) {
      setRebuildToast({ message: err?.message || "Rebuild failed", type: "error" });
    } finally {
      setRebuildingSpec(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Link
          to="/admin"
          style={{
            padding: "0.5rem 1rem",
            background: "#f1f5f9",
            color: "#475569",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          ← Back to Admin
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Content Coverage</h1>
        <select
          value={specKey}
          onChange={(e) => setSpecKey(e.target.value)}
          style={{
            padding: "0.5rem 1rem",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {SPEC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRebuildSpec}
          disabled={rebuildingSpec}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            background: rebuildingSpec ? "#e2e8f0" : "#e0f2fe",
            color: rebuildingSpec ? "#94a3b8" : "#0369a1",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            cursor: rebuildingSpec ? "not-allowed" : "pointer",
          }}
        >
          {rebuildingSpec ? "Rebuilding…" : "Rebuild Graph For Spec"}
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setViewMode("coverage")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "coverage" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "coverage" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Coverage Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("gaps")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "gaps" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "gaps" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Gap Priorities
          </button>
        </div>
        {lastRefreshed && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </span>
        )}
        {viewMode === "coverage" && data && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {data.topics.length} topic{data.topics.length !== 1 ? "s" : ""}
          </span>
        )}
        {viewMode === "gaps" && gapsData && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {gapsData.summary.weakTopics} weak, {gapsData.summary.partialTopics} partial, {gapsData.summary.strongTopics} strong
          </span>
        )}
      </div>

      {rebuildToast && (
        <Toast
          message={rebuildToast.message}
          type={rebuildToast.type}
          onClose={() => setRebuildToast(null)}
        />
      )}

      {error && (
        <div
          style={{
            padding: "1rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#b91c1c",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
          Loading...
        </div>
      ) : viewMode === "gaps" && gapsData ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 1.2fr 1.5fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Score</div>
            <div>Status</div>
            <div>Priority</div>
            <div>Flags</div>
            <div>Recommended Action</div>
          </div>
          {gapsData.gaps.map((g, i) => (
            <div
              key={`${g.topicKey}-${i}`}
              onClick={() => openGapDrawer(g)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openGapDrawer(g)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 1.2fr 1.5fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(g.topicKey || "")}</div>
              <div>{g.coverageScore ?? 0}</div>
              <div>
                <StatusBadge status={g.coverageStatus || "weak"} />
              </div>
              <div style={{ fontWeight: 600, color: g.priorityScore >= 40 ? "#b91c1c" : "#475569" }}>
                {g.priorityScore ?? 0}
              </div>
              <div>
                <GapFlagsBadges gapFlags={g.gapFlags} />
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                {g.recommendations?.[0] || "—"}
              </div>
            </div>
          ))}
          {gapsData.gaps.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No topics found for this spec.
            </div>
          )}
        </div>
      ) : data ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.9fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Unit</div>
            <div>Lessons</div>
            <div>Flashcards</div>
            <div>Quizzes</div>
            <div>Exam Qs</div>
            <div>Issues</div>
            <div>Score</div>
            <div>Status</div>
          </div>
          {data.topics.map((t, i) => (
            <div
              key={`${t.topicKey}-${i}`}
              onClick={() => openDrawer(t)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openDrawer(t)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.9fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(t.topicKey || "")}</div>
              <div style={{ color: "#64748b" }}>{t.unit || "—"}</div>
              <div>{t.lessonCount ?? 0}</div>
              <div>{t.flashcardCount ?? 0}</div>
              <div>{t.quizCount ?? 0}</div>
              <div>{t.examQuestionCount ?? 0}</div>
              <div>{t.issueCount ?? 0}</div>
              <div>{t.coverageScore ?? 0}</div>
              <div>
                <StatusBadge status={t.status || "weak"} />
              </div>
            </div>
          ))}
          {data.topics.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No topics found for this spec.
            </div>
          )}
        </div>
      ) : null}

      {/* Gap detail drawer */}
      {drawerOpen && selectedGap && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedGap.topicKey || "")}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#64748b",
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {selectedGap.summaryParagraph && (
              <div style={{ marginBottom: "1rem", color: "#475569", lineHeight: 1.5, fontSize: 14 }}>
                {selectedGap.summaryParagraph}
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Counts</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569" }}>
                <li>Lessons: {selectedGap.counts?.lessons ?? 0}</li>
                <li>Flashcards: {selectedGap.counts?.flashcards ?? 0}</li>
                <li>Quiz questions: {selectedGap.counts?.quizzes ?? 0}</li>
                <li>Exam questions: {selectedGap.counts?.examQuestions ?? 0}</li>
                <li>Open issues: {selectedGap.counts?.openIssues ?? 0}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Coverage</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Score: {selectedGap.coverageScore ?? 0}</span>
                <StatusBadge status={selectedGap.coverageStatus || "weak"} />
                <span style={{ fontSize: 12, color: "#64748b" }}>Priority: {selectedGap.priorityScore ?? 0}</span>
              </div>
            </div>
            {selectedGap.weakAreas && selectedGap.weakAreas.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Weak areas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedGap.weakAreas.map((w) => (
                    <span
                      key={w}
                      style={{
                        padding: "4px 10px",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedGap.recommendations && selectedGap.recommendations.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommendations</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                  {selectedGap.recommendations.map((r, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedGap.suggestedActions && selectedGap.suggestedActions.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested actions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedGap.suggestedActions.map((a, i) => {
                    const nav = mapSuggestedActionToNavigation(a, selectedGap);
                    const handleAction = () => {
                      if (nav.path.startsWith("/teacher/") && selectedGap.specKey) {
                        setStoredSpecKey(selectedGap.specKey as import("../api/taxonomy").SpecKey);
                      }
                      closeDrawer();
                      navigate(nav.path, nav.state ? { state: nav.state } : undefined);
                    };
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={handleAction}
                        style={{
                          padding: "8px 12px",
                          background: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          borderRadius: 6,
                          fontSize: 13,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#0369a1" }}>{a.label}</div>
                        <div style={{ color: "#475569", marginTop: 2 }}>{a.reason}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Topic detail drawer */}
      {drawerOpen && selectedTopic && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(400px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedTopic.topicKey || "")}
              </h2>
              <button
                type="button"
                onClick={closeDrawer}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#64748b",
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Unit</div>
              <div style={{ color: "#475569" }}>{selectedTopic.unit || "—"}</div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Linked content</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569" }}>
                <li>Lessons: {selectedTopic.lessonCount ?? 0}</li>
                <li>Flashcards: {selectedTopic.flashcardCount ?? 0}</li>
                <li>Quiz questions: {selectedTopic.quizCount ?? 0}</li>
                <li>Exam questions: {selectedTopic.examQuestionCount ?? 0}</li>
                <li>Open issues: {selectedTopic.issueCount ?? 0}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Coverage</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Score: {selectedTopic.coverageScore ?? 0}</span>
                <StatusBadge status={selectedTopic.status || "weak"} />
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                onClick={() => handleRebuildTopic()}
                disabled={rebuilding}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: rebuilding ? "#e2e8f0" : "#e0f2fe",
                  color: rebuilding ? "#94a3b8" : "#0369a1",
                  border: "1px solid #bae6fd",
                  borderRadius: 6,
                  cursor: rebuilding ? "not-allowed" : "pointer",
                }}
              >
                {rebuilding ? "Rebuilding…" : "Rebuild Topic Graph"}
              </button>
            </div>
            {selectedTopic.weakAreas && selectedTopic.weakAreas.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Weak areas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedTopic.weakAreas.map((w) => (
                    <span
                      key={w}
                      style={{
                        padding: "4px 10px",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ContentCoveragePage;
