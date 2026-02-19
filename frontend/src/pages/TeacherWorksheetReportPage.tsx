/**
 * PR-W4: Teacher report for one worksheet assignment. Route: /teacher/worksheet-assignments/:id/report
 * PR-W4.2: Attempts list + "View attempt" link to detail page.
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getReportSummary, getAssignmentAttempts, type AttemptListItem } from "../api/worksheetAssignments";

export default function TeacherWorksheetReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<{
    attemptsCount: number;
    submittedCount: number;
    avgScore: number;
    maxScore: number;
  } | null>(null);
  const [attempts, setAttempts] = useState<AttemptListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReportSummary(id)
      .then(setSummary)
      .catch((e: any) => {
        setError(e?.response?.data?.error || e?.message || "Failed to load report");
      });
    getAssignmentAttempts(id)
      .then(setAttempts)
      .catch(() => setAttempts([]));
  }, [id]);

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
      <h1 style={{ marginBottom: "24px" }}>Assignment results</h1>
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
                  <td style={{ padding: "10px 12px" }}>{a.status}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {a.status === "SUBMITTED" ? `${a.score} / ${a.maxScore}` : "—"}
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
