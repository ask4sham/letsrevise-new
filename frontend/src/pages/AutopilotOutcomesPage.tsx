/**
 * Admin Autopilot Outcomes Dashboard — analytics for autopilot effectiveness.
 * Route: /admin/autopilot-outcomes
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchAutopilotOutcomes,
  fetchAutopilotOutcomesByPromptPack,
  type AutopilotOutcomeSummary,
  type AutopilotOutcomesFilters,
  type PromptPackOutcomesItem,
} from "../api/contentGraph";

const SPEC_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All specs" },
  { value: "aqa-gcse-biology", label: "AQA GCSE Biology" },
  { value: "aqa-gcse-chemistry", label: "AQA GCSE Chemistry" },
  { value: "aqa-gcse-physics", label: "AQA GCSE Physics" },
  { value: "aqa-gcse-maths-foundation", label: "AQA GCSE Maths (Foundation)" },
  { value: "aqa-gcse-maths-higher", label: "AQA GCSE Maths (Higher)" },
];

const DAYS_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

function topicDisplay(topicKey: string): string {
  const part = topicKey.includes(":") ? topicKey.split(":").pop() : topicKey;
  return (part || topicKey).replace(/-/g, " ");
}

const AutopilotOutcomesPage: React.FC = () => {
  const [filters, setFilters] = useState<AutopilotOutcomesFilters>({ days: 30 });
  const [data, setData] = useState<AutopilotOutcomeSummary | null>(null);
  const [promptPackData, setPromptPackData] = useState<PromptPackOutcomesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOutcomes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, packRes] = await Promise.all([
        fetchAutopilotOutcomes(filters),
        fetchAutopilotOutcomesByPromptPack(filters),
      ]);
      setData(res);
      setPromptPackData(packRes.promptPacks || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load outcomes");
      setData(null);
      setPromptPackData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadOutcomes();
  }, [loadOutcomes]);

  const totals = data?.totals ?? {
    runs: 0,
    dryRuns: 0,
    liveRuns: 0,
    completedRuns: 0,
    partialRuns: 0,
    failedRuns: 0,
    generatedFlashcards: 0,
    generatedQuizzes: 0,
    generatedExamQuestions: 0,
    approvedItems: 0,
    rejectedItems: 0,
  };

  const generatedTotal = totals.generatedFlashcards + totals.generatedQuizzes + totals.generatedExamQuestions;

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
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Autopilot Outcomes</h1>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <select
          value={filters.specKey ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, specKey: e.target.value || undefined }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
        >
          {SPEC_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Topic key filter"
          value={filters.topicKey ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, topicKey: e.target.value || undefined }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, minWidth: 160 }}
        />
        <select
          value={filters.days ?? 30}
          onChange={(e) => setFilters((f) => ({ ...f, days: parseInt(e.target.value, 10) }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
        >
          {DAYS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={loadOutcomes}
          disabled={loading}
          style={{
            padding: "6px 12px",
            background: loading ? "#e2e8f0" : "#0369a1",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Total Runs</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totals.runs}</div>
        </div>
        <div style={{ padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Live Runs</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totals.liveRuns}</div>
        </div>
        <div style={{ padding: 16, background: "#ecfdf5", borderRadius: 8, border: "1px solid #a7f3d0" }}>
          <div style={{ fontSize: 12, color: "#047857", marginBottom: 4 }}>Generated</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#047857" }}>{generatedTotal}</div>
        </div>
        <div style={{ padding: 16, background: "#d1fae5", borderRadius: 8, border: "1px solid #6ee7b7" }}>
          <div style={{ fontSize: 12, color: "#065f46", marginBottom: 4 }}>Approved</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#065f46" }}>{totals.approvedItems}</div>
        </div>
        <div style={{ padding: 16, background: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d" }}>
          <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>Rejected</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#92400e" }}>{totals.rejectedItems}</div>
        </div>
        <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
          <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 4 }}>Failed Runs</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#b91c1c" }}>{totals.failedRuns}</div>
        </div>
      </div>

      {/* Repeated Failures */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>Repeated Failures</h2>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Topic</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Fail Count</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Skip Count</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Latest Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : !data?.repeatedFailures?.length ? (
                <tr>
                  <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No repeated failures in this period.
                  </td>
                </tr>
              ) : (
                data.repeatedFailures.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px" }}>
                      {r.topicTitle || topicDisplay(r.topicKey)} ({r.specKey})
                    </td>
                    <td style={{ padding: "10px 12px" }}>{r.failCount}</td>
                    <td style={{ padding: "10px 12px" }}>{r.skipCount}</td>
                    <td style={{ padding: "10px 12px", maxWidth: 200 }}>{r.latestReason || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Coverage Lift */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>Top Coverage Lift</h2>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Topic</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Latest Coverage Score</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Coverage Lift</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Lift Type</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : !data?.topCoverageLiftTopics?.length ? (
                <tr>
                  <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No coverage lift data in this period.
                  </td>
                </tr>
              ) : (
                data.topCoverageLiftTopics.map((t, i) => {
                  const lift = t.liftType === "true" ? t.trueCoverageLift : t.estimatedCoverageLift;
                  const isTrue = t.liftType === "true";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 12px" }}>
                        {t.topicTitle || topicDisplay(t.topicKey)} ({t.specKey})
                      </td>
                      <td style={{ padding: "10px 12px" }}>{t.latestCoverageScore ?? "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {lift != null ? (
                          <span style={isTrue ? { fontWeight: 600, color: "#047857" } : undefined}>
                            {lift >= 0 ? "+" : ""}{lift}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: isTrue ? "#d1fae5" : "#fef3c7",
                            color: isTrue ? "#065f46" : "#92400e",
                          }}
                        >
                          {isTrue ? "true" : "estimated"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prompt Pack Performance */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>Prompt Pack Performance</h2>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Prompt Pack</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Version</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Runs</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Generated Items</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Avg Coverage Lift</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : !promptPackData.length ? (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No prompt pack data. New autopilot runs include prompt pack version.
                  </td>
                </tr>
              ) : (
                promptPackData.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px" }}>{p.promptPackId}</td>
                    <td style={{ padding: "10px 12px" }}>{p.promptPackVersion}</td>
                    <td style={{ padding: "10px 12px" }}>{p.runs} ({p.liveRuns} live)</td>
                    <td style={{ padding: "10px 12px" }}>
                      {p.generatedFlashcards + p.generatedQuizzes + p.generatedExamQuestions}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {p.avgCoverageLift != null ? (p.avgCoverageLift >= 0 ? "+" : "") + p.avgCoverageLift : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#64748b", marginTop: 16 }}>
        True lift: before/after coverage snapshots for each run. Estimated: legacy runs without before baseline.
      </p>
    </div>
  );
};

export default AutopilotOutcomesPage;
