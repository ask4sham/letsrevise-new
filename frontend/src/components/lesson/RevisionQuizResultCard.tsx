/**
 * Compact green result card for completed Revision practice.
 * Shows quiz score (e.g. 4/4), never raw topic-mastery "1 / 1.0".
 */
import React from "react";

export type RevisionQuizResultCardProps = {
  /** Auto-gradable correct count; null = unknown (legacy) — card omitted. */
  score: number | null;
  questionCount: number;
};

function resultCopy(score: number, questionCount: number): string {
  if (questionCount <= 0) return "Quiz complete.";
  const pct = Math.round((score / questionCount) * 100);
  if (pct >= 100) return "✅ Great job — you understand this topic well.";
  if (pct >= 80) return "✅ Strong result — keep practising to stay sharp.";
  if (pct >= 50) return "📚 Good effort — review the questions you missed.";
  return "🔄 Keep going — review this topic and try again.";
}

export function RevisionQuizResultCard({
  score,
  questionCount,
}: RevisionQuizResultCardProps): React.ReactElement | null {
  if (score == null || questionCount <= 0) return null;
  const safeScore = Math.max(0, Math.floor(score));
  const safeCount = Math.max(1, Math.floor(questionCount));

  return (
    <div
      data-testid="revision-quiz-result-card"
      style={{
        marginTop: 16,
        padding: 20,
        borderRadius: 14,
        border: "2px solid #10b981",
        background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 18, color: "#047857", marginBottom: 8 }}>
        {resultCopy(safeScore, safeCount)}
      </div>
      <div
        data-testid="revision-quiz-result-score"
        style={{ fontSize: 22, fontWeight: 900, color: "#065f46" }}
      >
        {safeScore}/{safeCount}
      </div>
    </div>
  );
}
