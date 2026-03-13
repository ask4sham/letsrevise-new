/**
 * PR-W6: Needs marking queue — list attempts with unmarked short answers, link to mark. Route: /teacher/worksheets/needs-marking
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getNeedsMarking, type NeedsMarkingItem } from "../api/worksheetAssignments";

export default function TeacherNeedsMarkingPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NeedsMarkingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNeedsMarking()
      .then(setItems)
      .catch((e: any) => {
        setError(e?.response?.data?.error || e?.message || "Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "24px" }}>Needs marking</h1>

      {items.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: "1rem" }}>Nothing to mark right now.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((row) => (
            <li
              key={row.attemptId}
              style={{
                borderBottom: "1px solid #e2e8f0",
                padding: "16px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                  {row.worksheetTitle || "Worksheet"}
                  {row.assignmentTitle && (
                    <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "8px" }}>({row.assignmentTitle})</span>
                  )}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#475569" }}>
                  {row.studentName || "—"} · Unmarked: {row.unmarkedCount} / {row.totalShortCount}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "#94a3b8", marginTop: "4px" }}>
                  Submitted {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/teacher/worksheet-attempts/${row.attemptId}`)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#2563eb",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Mark
              </button>
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: "24px" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db" }}
        >
          Back
        </button>
      </p>
    </div>
  );
}
