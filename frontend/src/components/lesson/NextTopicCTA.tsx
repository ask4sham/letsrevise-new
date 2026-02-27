/**
 * PR-STUDENT-LESSON-NAV-1: Next topic CTA at bottom of student lesson.
 * Uses taxonomy ordering (same as topic picker) to show next topic or "Back to topics".
 */
import React, { useMemo } from "react";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import type { SpecKey, TaxonomyTopic } from "../../api/taxonomy";

function normalizeKey(key: string): string {
  const s = (key || "").trim();
  if (!s) return "";
  const withoutNamespace = s.includes(":") ? s.split(":").pop() || s : s;
  return withoutNamespace.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export interface NextTopicCTAProps {
  specKey: SpecKey;
  currentTopicKey: string;
  onNavigate: (nextTopicKey: string) => void;
  /** Called when user clicks "Back to topics" (last topic). If not set, onNavigate("") is used. */
  onBackToTopics?: () => void;
}

export function NextTopicCTA({
  specKey,
  currentTopicKey,
  onNavigate,
  onBackToTopics,
}: NextTopicCTAProps): React.ReactElement | null {
  const { data: taxonomy, loading, error } = useTaxonomy(specKey);

  const { nextTopic, isLast } = useMemo(() => {
    if (!taxonomy?.units?.length || !currentTopicKey?.trim()) return { nextTopic: null, isLast: false };
    const ordered: { key: string; title: string }[] = [];
    for (const u of taxonomy.units) {
      for (const t of (u.topics || []) as TaxonomyTopic[]) {
        ordered.push({ key: t.key ?? "", title: t.topic ?? "" });
      }
    }
    const normalized = normalizeKey(currentTopicKey);
    if (!normalized) return { nextTopic: null, isLast: false };
    const index = ordered.findIndex((t) => normalizeKey(t.key) === normalized);
    if (index < 0) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[NextTopicCTA] currentTopicKey not found in taxonomy:", currentTopicKey, "ordered keys:", ordered.map((o) => o.key));
      }
      return { nextTopic: null, isLast: false };
    }
    if (index + 1 < ordered.length) {
      return { nextTopic: ordered[index + 1], isLast: false };
    }
    return { nextTopic: null, isLast: true };
  }, [taxonomy, currentTopicKey]);

  if (loading || error) return null;
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
            Next topic: {nextTopic.title} →
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
