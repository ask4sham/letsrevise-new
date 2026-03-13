/**
 * PR-EDGE-4: Student view of their worksheet attempt (read-only).
 */
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAttempt } from "../api/worksheetAssignments";

export default function StudentWorksheetAttemptViewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) {
      setError("Missing attempt ID");
      setLoading(false);
      return;
    }
    getAttempt(attemptId)
      .then(setAttempt)
      .catch((e: any) => setError(e?.response?.data?.error || e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Link to="/student/my-work" style={{ color: "#2563eb" }}>← My Work</Link>
        <p style={{ color: "#991b1b", marginTop: 16 }}>{error}</p>
      </div>
    );
  }
  if (!attempt) return null;

  const status = attempt.status || "IN_PROGRESS";
  const displayStatus = status === "IN_PROGRESS" ? "In progress" : status === "SUBMITTED" ? "Awaiting release" : "Marked";
  const released = !!attempt.isReleased;

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: "0 auto" }}>
      <Link to="/student/my-work" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
        ← My Work
      </Link>
      <div style={{ marginTop: 24, padding: 20, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: 18 }}>Worksheet attempt</h2>
        <p style={{ margin: "0 0 8px 0", color: "#6b7280" }}>Status: {displayStatus}</p>
        {released && attempt.score != null && attempt.maxScore != null && (
          <p style={{ margin: 0, fontWeight: 600 }}>
            Score: {attempt.score} / {attempt.maxScore}
          </p>
        )}
        {!released && status === "SUBMITTED" && (
          <p style={{ margin: "8px 0 0 0", fontSize: 14, color: "#6b7280" }}>
            Your teacher will mark your answers and release the results.
          </p>
        )}
      </div>
    </div>
  );
}
