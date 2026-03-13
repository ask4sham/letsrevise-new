/**
 * PR-EDGE-4.1: Student quiz/assessment page by share link. Route: /q/:shareId
 * Loads assignment by shareId; shows landing with link to lesson (quiz) or paper (assessment).
 */
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getQuizAssignmentByShareId, type QuizAssignmentSharePayload } from "../api/quizAssignments";

export default function StudentQuizPage() {
  const { shareId: shareIdParam } = useParams<{ shareId: string }>();
  const shareId = shareIdParam || "";
  const [data, setData] = useState<QuizAssignmentSharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) {
      setError("Missing share link.");
      setLoading(false);
      return;
    }
    getQuizAssignmentByShareId(shareId)
      .then(setData)
      .catch((e: any) => setError(e?.response?.data?.error || e?.message || "Could not load quiz."))
      .finally(() => setLoading(false));
  }, [shareId]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <p style={{ color: "#991b1b", marginBottom: 16 }}>{error}</p>
        <Link to="/student/my-work" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          ← My Work
        </Link>
      </div>
    );
  }
  if (!data) return null;

  const { assignment, lesson, paper, closed } = data;
  const isQuiz = assignment.kind === "quiz";
  const title = assignment.title || (isQuiz ? "Quiz" : "Assessment");

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Link to="/student/my-work" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          ← My Work
        </Link>
      </div>
      <div
        style={{
          padding: 24,
          background: "#f9fafb",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <h1 style={{ margin: "0 0 8px 0", fontSize: 22 }}>{title}</h1>
        <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: 14 }}>
          {isQuiz ? "Quiz" : "Assessment"}
          {assignment.dueAt && (
            <> · Due {new Date(assignment.dueAt).toLocaleDateString()}</>
          )}
        </p>
        {closed ? (
          <p style={{ margin: 0, color: "#6b7280" }}>This assignment is closed.</p>
        ) : lesson ? (
          <Link
            to={`/lesson/${lesson._id}`}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Open lesson
          </Link>
        ) : paper ? (
          <Link
            to={`/assessments/papers/${paper._id}/start`}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Start assessment
          </Link>
        ) : (
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>
            Use the link from your teacher to take this {isQuiz ? "quiz" : "assessment"}.
          </p>
        )}
      </div>
    </div>
  );
}
