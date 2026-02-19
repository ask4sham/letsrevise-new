/**
 * PR-W4: Teacher report for one worksheet assignment. Route: /teacher/worksheet-assignments/:id/report
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getReportSummary } from "../api/worksheetAssignments";

export default function TeacherWorksheetReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<{
    attemptsCount: number;
    submittedCount: number;
    avgScore: number;
    maxScore: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReportSummary(id)
      .then(setSummary)
      .catch((e: any) => {
        setError(e?.response?.data?.error || e?.message || "Failed to load report");
      });
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
      <p style={{ marginTop: "24px" }}>
        <button type="button" onClick={() => navigate(-1)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db" }}>
          Back
        </button>
      </p>
    </div>
  );
}
