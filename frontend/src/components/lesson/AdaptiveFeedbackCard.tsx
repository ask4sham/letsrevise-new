/**
 * PR — Adaptive Testing Loop: Adaptive feedback based on topic mastery.
 * Renders below the testing section. Shows different messages and actions by mastery tier.
 */
import React from "react";
import { Link } from "react-router-dom";

export type MasteryTier = "strong" | "review" | "weak";

export interface AdaptiveFeedbackCardProps {
  masteryScore: number;
  topicKey: string;
  /** Link to next lesson in topic (optional). */
  nextLessonHref?: string;
  /** Callback to scroll to flashcards section. */
  onReviewFlashcards?: () => void;
  /** Callback to trigger 2 more practice questions. */
  onTryMorePractice?: () => void;
  /** Callback to scroll to top / show explanation. */
  onReviewContent?: () => void;
  /** Callback to scroll to diagram/visual (weak tier). */
  onShowDiagram?: () => void;
  /** Whether user has answered at least one question. */
  hasAttempts?: boolean;
}

function getTier(score: number): MasteryTier {
  if (score >= 0.8) return "strong";
  if (score >= 0.5) return "review";
  return "weak";
}

export const AdaptiveFeedbackCard: React.FC<AdaptiveFeedbackCardProps> = ({
  masteryScore,
  topicKey,
  nextLessonHref,
  onReviewFlashcards,
  onTryMorePractice,
  onReviewContent,
  onShowDiagram,
  hasAttempts = true,
}) => {
  const tier = getTier(masteryScore);
  const pct = Math.round(masteryScore * 100);

  if (!hasAttempts) return null;

  const cardStyle: React.CSSProperties = {
    marginTop: 20,
    padding: 20,
    borderRadius: 14,
    border: "2px solid",
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    background: "white",
  };

  if (tier === "strong") {
    return (
      <div
        style={{
          ...cardStyle,
          borderColor: "#10b981",
          background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, color: "#047857", marginBottom: 8 }}>
          ✅ Great job — you understand this topic well.
        </div>
        <div style={{ fontSize: 14, color: "#065f46", marginBottom: 16 }}>
          Your mastery: {pct}% ({Math.round(masteryScore * 10) / 10} / 1.0)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {nextLessonHref ? (
            <Link
              to={nextLessonHref}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "#10b981",
                color: "white",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Continue to next lesson →
            </Link>
          ) : (
            <Link
              to={`/browse-lessons?topicKey=${encodeURIComponent(topicKey)}`}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                background: "#10b981",
                color: "white",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Browse more lessons →
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (tier === "review") {
    return (
      <div
        style={{
          ...cardStyle,
          borderColor: "#f59e0b",
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, color: "#b45309", marginBottom: 8 }}>
          📚 You may want to review this concept.
        </div>
        <div style={{ fontSize: 14, color: "#92400e", marginBottom: 16 }}>
          Your mastery: {pct}% — a bit more practice will help.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {onReviewFlashcards && (
            <button
              type="button"
              onClick={onReviewFlashcards}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "2px solid #f59e0b",
                background: "white",
                color: "#b45309",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Review flashcards
            </button>
          )}
          {onTryMorePractice && (
            <button
              type="button"
              onClick={onTryMorePractice}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "#f59e0b",
                color: "white",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Try 2 more practice questions
            </button>
          )}
        </div>
      </div>
    );
  }

  // tier === "weak"
  return (
    <div
      style={{
        ...cardStyle,
        borderColor: "#ef4444",
        background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 18, color: "#b91c1c", marginBottom: 8 }}>
        🔄 Let&apos;s reinforce this topic.
      </div>
      <div style={{ fontSize: 14, color: "#991b1b", marginBottom: 16 }}>
        Your mastery: {pct}% — reviewing the content and practicing will help.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {onReviewContent && (
          <button
            type="button"
            onClick={onReviewContent}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "2px solid #ef4444",
              background: "white",
              color: "#b91c1c",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Review explanation again
          </button>
        )}
        {onShowDiagram && (
          <button
            type="button"
            onClick={onShowDiagram}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "2px solid #ef4444",
              background: "white",
              color: "#b91c1c",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Show diagram
          </button>
        )}
        {onReviewFlashcards && (
          <button
            type="button"
            onClick={onReviewFlashcards}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "2px solid #ef4444",
              background: "white",
              color: "#b91c1c",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Review flashcards
          </button>
        )}
        {onTryMorePractice && (
          <button
            type="button"
            onClick={onTryMorePractice}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#ef4444",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try new practice question
          </button>
        )}
      </div>
    </div>
  );
};
