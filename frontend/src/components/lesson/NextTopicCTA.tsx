/**
 * PR-STUDENT-LESSON-NAV-1: Next/Previous topic CTA.
 * direction="next" → bottom of lesson (next topic or "Back to topics").
 * direction="prev" → sidebar footer (previous topic link or label-only when first).
 */
import React, { useMemo } from "react";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { getTaxonomyTopicsFlat, type SpecKey } from "../../api/taxonomy";

/** Strip optional specKey: prefix only; no lowercasing or slugify to avoid breaking taxonomy key matching. */
function topicKeyWithoutSpecPrefix(key: string): string {
  const s = (key || "").trim();
  if (!s) return "";
  return s.includes(":") ? s.split(":").slice(1).join(":").trim() : s;
}

export interface NextTopicCTAProps {
  specKey: SpecKey;
  currentTopicKey: string;
  onNavigate: (topicKey: string) => void;
  /** Called when user clicks "Back to topics" (last topic). If not set, onNavigate("") is used. */
  onBackToTopics?: () => void;
  /** "next" = bottom CTA (next topic / Back to topics). "prev" = sidebar (previous topic or label only). */
  direction?: "next" | "prev";
}

export function NextTopicCTA({
  specKey,
  currentTopicKey,
  onNavigate,
  onBackToTopics,
  direction = "next",
}: NextTopicCTAProps): React.ReactElement | null {
  const { data: taxonomy, loading, error } = useTaxonomy(specKey);

  const { prevTopic, nextTopic, isLast } = useMemo(() => {
    if (!taxonomy?.units?.length || !currentTopicKey?.trim()) {
      return { prevTopic: null, nextTopic: null, isLast: false };
    }
    const ordered = getTaxonomyTopicsFlat(taxonomy).map((t) => ({
      key: (t.key ?? "").trim(),
      title: t.topic ?? "",
    }));
    const currentRaw = topicKeyWithoutSpecPrefix(currentTopicKey);
    if (!currentRaw) return { prevTopic: null, nextTopic: null, isLast: false };
    const index = ordered.findIndex((t) => t.key === currentRaw || topicKeyWithoutSpecPrefix(t.key) === currentRaw);
    if (index < 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[NextTopicCTA] currentTopicKey not found in taxonomy:", currentTopicKey, "ordered keys:", ordered.map((o) => o.key));
      }
      return { prevTopic: null, nextTopic: null, isLast: false };
    }
    const prev = index > 0 ? ordered[index - 1] : null;
    const next = index + 1 < ordered.length ? ordered[index + 1] : null;
    const isLastTopic = index + 1 >= ordered.length;
    return { prevTopic: prev, nextTopic: next, isLast: isLastTopic };
  }, [taxonomy, currentTopicKey]);

  if (loading || error) return null;

  // ----- direction="prev" (sidebar) -----
  if (direction === "prev") {
    const labelStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, marginBottom: 4 };
    return (
      <div style={{ marginTop: 12 }}>
        <div style={labelStyle}>Previous topic</div>
        {prevTopic ? (
          <button
            type="button"
            onClick={() => onNavigate(prevTopic.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #94a3b8",
              background: "#f8fafc",
              color: "#334155",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
              textAlign: "left",
              width: "100%",
            }}
          >
            ← {prevTopic.title}
          </button>
        ) : null}
      </div>
    );
  }

  // ----- direction="next" (bottom CTA) -----
  if (!nextTopic && !isLast) return null;

  const handleBack = () => {
    if (onBackToTopics) onBackToTopics();
    else onNavigate("");
  };

  return (
    <div
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {nextTopic ? (
        <>
          <span style={{ color: "#64748b", fontSize: 14 }}>
            Next topic: <strong style={{ color: "#0f172a" }}>{nextTopic.title}</strong>
          </span>
          <button
            type="button"
            onClick={() => onNavigate(nextTopic.key)}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #3b82f6",
              background: "#eff6ff",
              color: "#1d4ed8",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {nextTopic.title} →
          </button>
        </>
      ) : (
        <>
          <span style={{ color: "#64748b", fontSize: 14 }}>
            You&apos;re at the last topic in this section.
          </span>
          <button
            type="button"
            onClick={handleBack}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #94a3b8",
              background: "#f1f5f9",
              color: "#475569",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Back to topics
          </button>
        </>
      )}
    </div>
  );
}

export default NextTopicCTA;
