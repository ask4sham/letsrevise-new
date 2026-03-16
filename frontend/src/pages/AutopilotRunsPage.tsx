/**
 * Admin Autopilot Run History — audit trail for autopilot runs.
 * Route: /admin/autopilot-runs
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchAutopilotRuns,
  fetchAutopilotRunById,
  type AutopilotRunSummary,
  type AutopilotRunDetail,
  type AutopilotRunsFilters,
} from "../api/contentGraph";
import Toast from "../components/Toast";

const SPEC_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All specs" },
  { value: "aqa-gcse-biology", label: "AQA GCSE Biology" },
  { value: "aqa-gcse-chemistry", label: "AQA GCSE Chemistry" },
  { value: "aqa-gcse-physics", label: "AQA GCSE Physics" },
  { value: "aqa-gcse-maths-foundation", label: "AQA GCSE Maths (Foundation)" },
  { value: "aqa-gcse-maths-higher", label: "AQA GCSE Maths (Higher)" },
];

const RUN_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "topic", label: "Topic" },
  { value: "spec", label: "Spec" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
];

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { dateStyle: "short" }) + " " + d.toLocaleTimeString(undefined, { timeStyle: "short" });
  } catch {
    return "—";
  }
}

function statusBadge(status: string) {
  const style =
    status === "completed"
      ? { background: "#d4edda", color: "#155724" }
      : status === "partial"
      ? { background: "#fff3cd", color: "#856404" }
      : { background: "#f8d7da", color: "#721c24" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, ...style }}>
      {status}
    </span>
  );
}

const AutopilotRunsPage: React.FC = () => {
  const [filters, setFilters] = useState<AutopilotRunsFilters>({});
  const [items, setItems] = useState<AutopilotRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailRun, setDetailRun] = useState<AutopilotRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAutopilotRuns(filters);
      setItems(res.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load runs");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const openDetail = async (run: AutopilotRunSummary) => {
    setDetailRun(null);
    setDetailLoading(true);
    try {
      const full = await fetchAutopilotRunById(run._id);
      setDetailRun(full);
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || "Failed to load run", type: "error" });
    } finally {
      setDetailLoading(false);
    }
  };

  const summaryStr = (s: AutopilotRunSummary) => {
    const sum = s.summary;
    if (!sum) return "—";
    const parts = [];
    if (sum.generatedFlashcards) parts.push(`${sum.generatedFlashcards} FC`);
    if (sum.generatedQuizzes) parts.push(`${sum.generatedQuizzes} Q`);
    if (sum.generatedExamQuestions) parts.push(`${sum.generatedExamQuestions} EQ`);
    if (sum.skippedActions) parts.push(`${sum.skippedActions} skipped`);
    if (sum.failedActions) parts.push(`${sum.failedActions} failed`);
    return parts.length ? parts.join(", ") : "—";
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
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Autopilot Run History</h1>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
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
          value={filters.runType ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, runType: e.target.value || undefined }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
        >
          {RUN_TYPE_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={filters.status ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={filters.dryRun === true}
            onChange={(e) => setFilters((f) => ({ ...f, dryRun: e.target.checked ? true : undefined }))}
          />
          Dry run only
        </label>
        <button
          type="button"
          onClick={loadRuns}
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

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Created At</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Run Type</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Spec</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Topic</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Dry Run</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Status</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Summary</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No runs found. Run Autopilot from Content Coverage to create records.
                </td>
              </tr>
            ) : (
              items.map((run) => (
                <tr
                  key={run._id}
                  style={{ cursor: "pointer" }}
                  onClick={() => openDetail(run)}
                >
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{formatDate(run.createdAt)}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{run.runType}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{run.specKey}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{run.topicKey || "—"}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{run.dryRun ? "Yes" : "No"}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{statusBadge(run.status)}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{summaryStr(run)}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(run);
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        background: "#0369a1",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {detailLoading && (
        <div style={{ position: "fixed", top: 20, right: 20, padding: "1rem", background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", borderRadius: 8, zIndex: 1001 }}>
          Loading run details…
        </div>
      )}
      {detailRun && !detailLoading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: 480,
            maxWidth: "100%",
            height: "100%",
            background: "white",
            boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
            zIndex: 1000,
            overflowY: "auto",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Run details</h2>
            <button
              type="button"
              onClick={() => setDetailRun(null)}
              style={{
                padding: "4px 12px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
          <dl style={{ margin: 0, fontSize: 14 }}>
            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Created</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{formatDate(detailRun.createdAt)}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Run type</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailRun.runType}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Spec</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailRun.specKey}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Topic</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailRun.topicKey || "—"}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Dry run</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailRun.dryRun ? "Yes" : "No"}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Status</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{statusBadge(detailRun.status)}</dd>

            {detailRun.errorMessage && (
              <>
                <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Error</dt>
                <dd style={{ margin: "2px 0 0 0", color: "#b91c1c" }}>{detailRun.errorMessage}</dd>
              </>
            )}

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Summary</dt>
            <dd style={{ margin: "2px 0 0 0" }}>
              {detailRun.summary && (
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {detailRun.summary.generatedFlashcards != null && (
                    <li>Flashcards: {detailRun.summary.generatedFlashcards}</li>
                  )}
                  {detailRun.summary.generatedQuizzes != null && (
                    <li>Quizzes: {detailRun.summary.generatedQuizzes}</li>
                  )}
                  {detailRun.summary.generatedExamQuestions != null && (
                    <li>Exam questions: {detailRun.summary.generatedExamQuestions}</li>
                  )}
                  {detailRun.summary.skippedActions != null && (
                    <li>Skipped actions: {detailRun.summary.skippedActions}</li>
                  )}
                  {detailRun.summary.failedActions != null && (
                    <li>Failed actions: {detailRun.summary.failedActions}</li>
                  )}
                </ul>
              )}
              {!detailRun.summary && "—"}
            </dd>

            {detailRun.topicResults && detailRun.topicResults.length > 0 && (
              <>
                <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 16 }}>Topic results</dt>
                <dd style={{ margin: "2px 0 0 0" }}>
                  {detailRun.topicResults.map((tr, i) => (
                    <div
                      key={i}
                      style={{
                        marginTop: 8,
                        padding: 12,
                        background: "#f8fafc",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{tr.topicTitle || tr.topicKey}</div>
                      {tr.requiresReview && (
                        <span style={{ fontSize: 12, color: "#92400e" }}>Requires review</span>
                      )}
                      {tr.plannedActions && tr.plannedActions.length > 0 && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>Planned: {tr.plannedActions.join(", ")}</div>
                      )}
                      {tr.executedActions && tr.executedActions.length > 0 && (
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: 20, fontSize: 12 }}>
                          {tr.executedActions.map((a, j) => (
                            <li key={j}>
                              {a.type}: {a.status}
                              {a.createdCount != null && ` (${a.createdCount})`}
                              {a.reason && ` — ${a.reason}`}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(tr.coverageBefore || tr.coverageAfter || tr.coverageLift != null) ? (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Coverage before: {tr.coverageBefore?.score ?? "—"} ({tr.coverageBefore?.status ?? "—"})
                          {" → "}
                          after: {tr.coverageAfter?.score ?? "—"} ({tr.coverageAfter?.status ?? "—"})
                          {tr.coverageLift != null && (
                            <span style={{ fontWeight: 600, marginLeft: 4 }}>
                              lift: {tr.coverageLift >= 0 ? "+" : ""}{tr.coverageLift}
                            </span>
                          )}
                        </div>
                      ) : tr.updatedCoverage && (
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          Coverage: {tr.updatedCoverage.status} (score: {tr.updatedCoverage.score ?? "—"})
                        </div>
                      )}
                    </div>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AutopilotRunsPage;
