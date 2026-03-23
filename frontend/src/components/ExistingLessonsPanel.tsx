/**
 * Shows reuse suggestions when teacher selects a topicKey: list of existing lessons
 * with View / Duplicate / Edit (if owner) / Improve with AI. Does not block creation; page's primary button = "Create anyway".
 */
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getLessonsByTopicKey, duplicateLesson, improveLessonWithAI, type LessonByTopicKeyItem } from "../api/lessons";

type Props = {
  topicKey: string;
  currentUserId?: string;
  /** Layout: "inline" (default) or "compact" for modals */
  layout?: "inline" | "compact";
  style?: React.CSSProperties;
  /** Optional AI form context for Improve with AI (instructions + strictSpec) */
  aiFormContext?: { additionalInstructions?: string; strictSpec?: boolean };
};

export function ExistingLessonsPanel({ topicKey, currentUserId, layout = "inline", style, aiFormContext }: Props) {
  const [lessons, setLessons] = useState<LessonByTopicKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!topicKey || !topicKey.trim()) {
      setLessons([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getLessonsByTopicKey(topicKey.trim(), { includeDrafts: true })
      .then((res) => {
        if (!cancelled) setLessons(res.lessons || []);
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topicKey]);

  const handleDuplicate = async (lessonId: string) => {
    setDuplicatingId(lessonId);
    try {
      const { lessonId: newId } = await duplicateLesson(lessonId);
      navigate(`/edit-lesson/${newId}`);
    } catch {
      setDuplicatingId(null);
    }
  };

  const handleImproveWithAI = async (lessonId: string) => {
    setImprovingId(lessonId);
    try {
      const { lessonId: newId } = await improveLessonWithAI(lessonId, {
        additionalInstructions: aiFormContext?.additionalInstructions?.trim() || undefined,
        strictSpec: aiFormContext?.strictSpec,
      });
      navigate(`/edit-lesson/${newId}`);
    } catch {
      setImprovingId(null);
    }
  };

  if (loading || lessons.length === 0) return null;

  const isCompact = layout === "compact";
  const panelStyle: React.CSSProperties = isCompact
    ? {
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 8,
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        fontSize: "0.8125rem",
        ...style,
      }
    : {
        marginTop: 12,
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        ...style,
      };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#0f172a" }}>
        Existing lessons for this sub-topic
      </div>
      <p style={{ margin: "0 0 8px", color: "#334155", fontSize: isCompact ? "0.8125rem" : "0.875rem" }}>
        You can reuse one of these, or create your own version below.
      </p>
      <ul style={{ margin: 0, paddingLeft: "18px", listStyle: "disc" }}>
        {lessons.map((lesson) => (
          <li key={lesson._id} style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 500 }}>{lesson.title}</span>
            {lesson.ownerName ? (
              <span style={{ color: "#64748b", fontSize: "0.75rem", marginLeft: 6 }}>
                — {lesson.ownerName}
                {lesson.isPublished ? " · Published" : " · Draft"}
              </span>
            ) : null}
            <div style={{ display: "inline-flex", gap: 8, marginLeft: 8, marginTop: 2, flexWrap: "wrap" }}>
              <a
                href={`/lesson/${lesson._id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 600 }}
              >
                View
              </a>
              <button
                type="button"
                onClick={() => handleDuplicate(lesson._id)}
                disabled={duplicatingId !== null}
                style={{
                  fontSize: "0.75rem",
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#2563eb",
                  fontWeight: 600,
                  cursor: duplicatingId !== null ? "not-allowed" : "pointer",
                }}
              >
                {duplicatingId === lesson._id ? "Duplicating…" : "Duplicate"}
              </button>
              {currentUserId && lesson.teacherId === currentUserId && (
                <Link
                  to={`/edit-lesson/${lesson._id}`}
                  style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 600 }}
                >
                  Edit
                </Link>
              )}
              {currentUserId && lesson.teacherId === currentUserId && (
                <button
                  type="button"
                  onClick={() => handleImproveWithAI(lesson._id)}
                  disabled={improvingId !== null}
                  style={{
                    fontSize: "0.75rem",
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "#16a34a",
                    fontWeight: 600,
                    cursor: improvingId !== null ? "not-allowed" : "pointer",
                  }}
                  title="Create an AI-improved draft (original unchanged)"
                >
                  {improvingId === lesson._id ? "Improving…" : "Improve with AI"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
