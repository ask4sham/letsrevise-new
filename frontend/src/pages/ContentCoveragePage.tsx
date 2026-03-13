/**
 * Admin Content Coverage page — spec-level topic coverage from content graph.
 * Route: /admin/content-coverage
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchSpecCoverage,
  rebuildTopicGraph,
  type TopicCoverageRow,
  type SpecCoverageResponse,
} from "../api/contentGraph";
import Toast from "../components/Toast";

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

const ContentCoveragePage: React.FC = () => {
  const [specKey, setSpecKey] = useState("aqa-gcse-biology");
  const [data, setData] = useState<SpecCoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicCoverageRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
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

  useEffect(() => {
    loadSpecCoverage();
  }, [loadSpecCoverage]);

  const openDrawer = (topic: TopicCoverageRow) => {
    setSelectedTopic(topic);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTopic(null);
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
        {lastRefreshed && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </span>
        )}
        {data && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {data.topics.length} topic{data.topics.length !== 1 ? "s" : ""}
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
          Loading coverage...
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
