/**
 * PR-STUDENT-LESSON-NAV-3: SS2-style prev/next topic bar at bottom of lesson.
 * Previous: title + left arrow (disabled when first). Next: title + right arrow (or Back to topics when last).
 */
import React, { useMemo } from "react";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import type { SpecKey, TaxonomyTopic } from "../../api/taxonomy";

function topicKeyWithoutSpecPrefix(key: string): string {
  const s = (key || "").trim();
  if (!s) return "";
  return s.includes(":") ? s.split(":").slice(1).join(":").trim() : s;
}

export interface LessonPrevNextBarProps {
  specKey: SpecKey;
  currentTopicKey: string;
  onNavigateTopic: (topicKey: string) => void;
  onBackToTopics?: () => void;
  /** Optional root class (e.g. V12 student presentation) */
  className?: string;
}

export function LessonPrevNextBar({
  specKey,
  currentTopicKey,
  onNavigateTopic,
  onBackToTopics,
  className,
}: LessonPrevNextBarProps): React.ReactElement | null {
  const { data: taxonomy, loading, error } = useTaxonomy(specKey);

  const { prevTopic, nextTopic, isLast } = useMemo(() => {
    if (!taxonomy?.units?.length || !currentTopicKey?.trim()) {
      return { prevTopic: null, nextTopic: null, isLast: false };
    }
    const ordered: { key: string; title: string }[] = [];
    for (const u of taxonomy.units) {
      for (const t of (u.topics || []) as TaxonomyTopic[]) {
        ordered.push({ key: (t.key ?? "").trim(), title: t.topic ?? "" });
      }
    }
    const currentRaw = topicKeyWithoutSpecPrefix(currentTopicKey);
    if (!currentRaw) return { prevTopic: null, nextTopic: null, isLast: false };
    const index = ordered.findIndex((t) => t.key === currentRaw || topicKeyWithoutSpecPrefix(t.key) === currentRaw);
    if (index < 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[LessonPrevNextBar] currentTopicKey not found in taxonomy:", currentTopicKey);
      }
      return { prevTopic: null, nextTopic: null, isLast: false };
    }
    const prev = index > 0 ? ordered[index - 1] : null;
    const next = index + 1 < ordered.length ? ordered[index + 1] : null;
    const isLastTopic = index + 1 >= ordered.length;
    return { prevTopic: prev, nextTopic: next, isLast: isLastTopic };
  }, [taxonomy, currentTopicKey]);

  if (loading || error) return null;

  const handleBack = () => {
    if (onBackToTopics) onBackToTopics();
    else onNavigateTopic("");
  };

  const titleStyle: React.CSSProperties = { color: "#0f172a", fontSize: 14, fontWeight: 600 };
  const buttonBase = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "2px solid rgba(0,0,0,0.20)",
    fontWeight: 800,
    cursor: "pointer" as const,
  };

  return (
    <div
      className={className}
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      {/* Previous — SS2: label removed; keep buttons only */}
      <div style={{ flex: "1 1 0", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={prevTopic ? titleStyle : { ...titleStyle, color: "#94a3b8" }}>
            {prevTopic ? prevTopic.title : "—"}
          </span>
          <button
            type="button"
            disabled={!prevTopic}
            onClick={() => prevTopic && onNavigateTopic(prevTopic.key)}
            style={{
              ...buttonBase,
              background: prevTopic ? "white" : "#f3f4f6",
              cursor: prevTopic ? "pointer" : "not-allowed",
              color: "#111827",
            }}
          >
            ← Previous
          </button>
        </div>
      </div>

      {/* Next — SS2: label removed for consistency */}
      <div style={{ flex: "1 1 0", minWidth: 0, textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isLast ? (
            <button
              type="button"
              onClick={handleBack}
              style={{
                ...buttonBase,
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #94a3b8",
              }}
            >
              Back to topics
            </button>
          ) : nextTopic ? (
            <>
              <span style={titleStyle}>{nextTopic.title}</span>
              <button
                type="button"
                onClick={() => onNavigateTopic(nextTopic.key)}
                style={{
                  ...buttonBase,
                  border: "none",
                  background: "#48bb78",
                  color: "white",
                }}
              >
                Next →
              </button>
            </>
          ) : (
            <>
              <span style={{ color: "#94a3b8", fontSize: 14 }}>—</span>
              <button type="button" disabled style={{ ...buttonBase, background: "#9ca3af", cursor: "not-allowed", color: "white", border: "none" }}>
                Next →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LessonPrevNextBar;
