/**
 * PR-W4: Teacher report for one worksheet assignment. Route: /teacher/worksheet-assignments/:id/report
 * PR-W4.2: Attempts list + "View attempt" link to detail page.
 * PR-W4.3: Close assignment button + Closed badge.
 */
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getReportSummary,
  getAssignmentAttempts,
  getAssignment,
  closeAssignment,
  type AttemptListItem,
} from "../api/worksheetAssignments";

export default function TeacherWorksheetReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<{ isActive: boolean } | null>(null);
  const [summary, setSummary] = useState<{
    attemptsCount: number;
    submittedCount: number;
    avgScore: number;
    maxScore: number;
  } | null>(null);
  const [attempts, setAttempts] = useState<AttemptListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    getAssignment(id)
      .then((a) => setAssignment({ isActive: a.isActive }))
      .catch(() => setAssignment(null));
    getReportSummary(id)
      .then(setSummary)
      .catch((e: any) => {
        setError(e?.response?.data?.error || e?.message || "Failed to load report");
      });
    getAssignmentAttempts(id)
      .then(setAttempts)
      .catch(() => setAttempts([]));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClose = useCallback(() => {
    if (!id || closing || assignment?.isActive === false) return;
    if (!window.confirm("Close this assignment? Students will no longer be able to start or submit attempts.")) return;
    setClosing(true);
    closeAssignment(id)
      .then((a) => {
        setAssignment({ isActive: a.isActive });
        refresh();
      })
      .catch((e: any) => {
        window.alert(e?.response?.data?.error || e?.message || "Failed to close assignment");
      })
      .finally(() => setClosing(false));
  }, [id, closing, assignment?.isActive, refresh]);

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: "560px", margin: "0 auto" }}>
        <p style={{ color: "#b91c1c", marginBottom: "16px" }}>{error}</p>
        <button type="button" onClick={() => navigate(-1)} style={{ padding: "8px 16px" }}>
          Back
        </button>
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading report…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
        <h1 style={{ margin: 0 }}>Assignment results</h1>
        {assignment?.isActive === false ? (
          <span style={{ padding: "6px 12px", borderRadius: "6px", background: "#f1f5f9", color: "#64748b", fontSize: "0.875rem", fontWeight: 500 }}>
            Closed
          </span>
        ) : assignment?.isActive === true ? (
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #dc2626", background: "#fff", color: "#dc2626", cursor: closing ? "wait" : "pointer", fontSize: "0.875rem" }}
          >
            {closing ? "Closing…" : "Close assignment"}
          </button>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}>
        <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Attempts</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{summary.attemptsCount}</div>
        </div>
        <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Submitted</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{summary.submittedCount}</div>
        </div>
        <div style={{ padding: "16px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Avg score</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            {summary.submittedCount > 0
              ? `${(summary.avgScore * 100).toFixed(0)}%${summary.maxScore > 0 ? ` (of ${summary.maxScore})` : ""}`
              : "—"}
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: "32px", marginBottom: "12px" }}>Attempts</h2>
      {attempts.length === 0 ? (
        <p style={{ color: "#64748b" }}>No attempts yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>Student name</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Score</th>
                <th style={{ padding: "10px 12px" }}>Submitted</th>
                <th style={{ padding: "10px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a._id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 12px" }}>{a.studentName || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {a.status}
                    {a.needsMarking && (
                      <span style={{ marginLeft: "6px", padding: "2px 6px", borderRadius: "4px", background: "#fef3c7", color: "#92400e", fontSize: "0.75rem" }}>
                        Needs marking
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {a.status === "SUBMITTED" || a.status === "MARKED" ? `${a.score} / ${a.maxScore}` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/teacher/worksheet-attempts/${a._id}`)}
                      style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #2563eb", background: "#eff6ff", color: "#2563eb", cursor: "pointer", fontSize: "0.8125rem" }}
                    >
                      View attempt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: "24px" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db" }}>
          Back
        </button>
      </p>
    </div>
  );
}
