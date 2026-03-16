/**
 * Admin Autopilot Prompt Quality Feedback — approval/rejection analytics.
 * Route: /admin/autopilot-feedback
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchAutopilotFeedback,
  fetchAutopilotFeedbackByPromptPack,
  type AutopilotFeedbackSummary,
  type AutopilotFeedbackFilters,
  type PromptPackFeedbackItem,
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

const REASON_LABELS: Record<string, string> = {
  missing_accuracy: "Missing accuracy",
  weak_explanation: "Weak explanation",
  duplicate_content: "Duplicate content",
  poor_exam_alignment: "Poor exam alignment",
  unclear_question: "Unclear question",
  other: "Other",
};

function topicDisplay(topicKey: string): string {
  const part = topicKey.includes(":") ? topicKey.split(":").pop() : topicKey;
  return (part || topicKey).replace(/-/g, " ");
}

const AutopilotFeedbackPage: React.FC = () => {
  const [filters, setFilters] = useState<AutopilotFeedbackFilters>({ days: 30 });
  const [data, setData] = useState<AutopilotFeedbackSummary | null>(null);
  const [promptPackData, setPromptPackData] = useState<PromptPackFeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, packRes] = await Promise.all([
        fetchAutopilotFeedback(filters),
        fetchAutopilotFeedbackByPromptPack(filters),
      ]);
      setData(res);
      setPromptPackData(packRes.promptPacks || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load feedback");
      setData(null);
      setPromptPackData([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const totals = data?.totals ?? {
    reviewedItems: 0,
    approvedItems: 0,
    rejectedItems: 0,
    approvalRate: 0,
  };

  const byType = data?.byType ?? {
    flashcard: { approved: 0, rejected: 0, reviewed: 0, approvalRate: 0 },
    quizQuestion: { approved: 0, rejected: 0, reviewed: 0, approvalRate: 0 },
    examQuestion: { approved: 0, rejected: 0, reviewed: 0, approvalRate: 0 },
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
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Autopilot Prompt Quality Feedback</h1>
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
          onClick={loadFeedback}
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
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Reviewed</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{totals.reviewedItems}</div>
        </div>
        <div style={{ padding: 16, background: "#ecfdf5", borderRadius: 8, border: "1px solid #a7f3d0" }}>
          <div style={{ fontSize: 12, color: "#047857", marginBottom: 4 }}>Approved</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#047857" }}>{totals.approvedItems}</div>
        </div>
        <div style={{ padding: 16, background: "#fef3c7", borderRadius: 8, border: "1px solid #fcd34d" }}>
          <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>Rejected</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#92400e" }}>{totals.rejectedItems}</div>
        </div>
        <div style={{ padding: 16, background: "#dbeafe", borderRadius: 8, border: "1px solid #93c5fd" }}>
          <div style={{ fontSize: 12, color: "#1d4ed8", marginBottom: 4 }}>Approval Rate</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1d4ed8" }}>{totals.approvalRate}%</div>
        </div>
      </div>

      {/* By type breakdown */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>By Content Type</h2>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Type</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Reviewed</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Approved</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Rejected</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px" }}>Flashcard</td>
                <td style={{ padding: "10px 12px" }}>{byType.flashcard.reviewed}</td>
                <td style={{ padding: "10px 12px" }}>{byType.flashcard.approved}</td>
                <td style={{ padding: "10px 12px" }}>{byType.flashcard.rejected}</td>
                <td style={{ padding: "10px 12px" }}>{byType.flashcard.approvalRate}%</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px" }}>Quiz Question</td>
                <td style={{ padding: "10px 12px" }}>{byType.quizQuestion.reviewed}</td>
                <td style={{ padding: "10px 12px" }}>{byType.quizQuestion.approved}</td>
                <td style={{ padding: "10px 12px" }}>{byType.quizQuestion.rejected}</td>
                <td style={{ padding: "10px 12px" }}>{byType.quizQuestion.approvalRate}%</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px" }}>Exam Question</td>
                <td style={{ padding: "10px 12px" }}>{byType.examQuestion.reviewed}</td>
                <td style={{ padding: "10px 12px" }}>{byType.examQuestion.approved}</td>
                <td style={{ padding: "10px 12px" }}>{byType.examQuestion.rejected}</td>
                <td style={{ padding: "10px 12px" }}>{byType.examQuestion.approvalRate}%</td>
              </tr>
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
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Reviewed</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Approved</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Rejected</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : !promptPackData.length ? (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No prompt pack data. New autopilot-generated content includes prompt metadata.
                  </td>
                </tr>
              ) : (
                promptPackData.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px" }}>{p.promptPackId}</td>
                    <td style={{ padding: "10px 12px" }}>{p.promptPackVersion}</td>
                    <td style={{ padding: "10px 12px" }}>{p.reviewedItems}</td>
                    <td style={{ padding: "10px 12px" }}>{p.approvedItems}</td>
                    <td style={{ padding: "10px 12px" }}>{p.rejectedItems}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: p.approvalRate < 50 ? "#b91c1c" : p.approvalRate < 80 ? "#92400e" : "#047857", fontWeight: 600 }}>
                        {p.approvalRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejection patterns */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>Rejection Patterns</h2>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Reason</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={2} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : !data?.rejectionPatterns?.length ? (
                <tr>
                  <td colSpan={2} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No rejection data in this period.
                  </td>
                </tr>
              ) : (
                data.rejectionPatterns.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px" }}>{REASON_LABELS[p.reason] ?? p.reason}</td>
                    <td style={{ padding: "10px 12px" }}>{p.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weak topics */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 12 }}>Weak Topics (Low Approval Rate)</h2>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Topic</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Reviewed</th>
                <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    Loading…
                  </td>
                </tr>
              ) : !data?.weakTopics?.length ? (
                <tr>
                  <td colSpan={3} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No weak topics in this period.
                  </td>
                </tr>
              ) : (
                data.weakTopics.map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "10px 12px" }}>
                      {topicDisplay(t.topicKey)} {t.specKey && `(${t.specKey})`}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{t.reviewedItems}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ color: t.approvalRate < 50 ? "#b91c1c" : t.approvalRate < 80 ? "#92400e" : "#047857", fontWeight: 600 }}>
                        {t.approvalRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#64748b", marginTop: 16 }}>
        Feedback from approval/rejection of autopilot-generated content. Use rejection patterns to improve prompts.
      </p>
    </div>
  );
};

export default AutopilotFeedbackPage;
