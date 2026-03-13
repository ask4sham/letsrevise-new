/**
 * PR-PAST-PAPERS-UI-2: List of past paper questions with expand for mark scheme.
 */
import React, { useState } from "react";
import type { PastPaperQuestionItem } from "../../api/pastPaperQuestions";
import type { TaxonomyResponse } from "../../api/taxonomy";

function topicSlugFromStoredKey(storedKey: string): string {
  if (!storedKey) return "";
  const i = storedKey.indexOf(":");
  return i >= 0 ? storedKey.slice(i + 1) : storedKey;
}

function topicDisplayName(slug: string, taxonomy: TaxonomyResponse | null): string {
  if (!taxonomy?.units) return slug;
  for (const u of taxonomy.units) {
    for (const t of u.topics || []) {
      if (t.key === slug) return t.topic || slug;
    }
  }
  return slug;
}

type Props = {
  items: PastPaperQuestionItem[];
  taxonomy: TaxonomyResponse | null;
};

export function PastPaperQuestionsList({ items, taxonomy }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 12 }}>
        No questions linked yet. Use “Link questions” to add teacher-authored questions to this paper.
      </p>
    );
  }

  const totalMarks = items.reduce((sum, q) => sum + (q.marks ?? 0), 0);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
        {items.length} question{items.length !== 1 ? "s" : ""}
        {totalMarks > 0 ? ` · ${totalMarks} marks total` : ""}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((q) => {
          const isExpanded = expandedId === q._id;
          const slug = topicSlugFromStoredKey(q.topicKey);
          const topicName = topicDisplayName(slug, taxonomy);
          const snippet = q.question.length > 80 ? q.question.slice(0, 80) + "…" : q.question;
          const markScheme = Array.isArray(q.markScheme) ? q.markScheme : [];

          return (
            <li
              key={q._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                marginBottom: 8,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, marginRight: 8 }}>
                    {q.questionNumber || "—"} {q.marks != null ? `(${q.marks} marks)` : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{topicName}</span>
                  <div style={{ marginTop: 4, fontSize: 13 }}>{snippet}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : q._id)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {isExpanded ? "Hide" : "View"}
                </button>
              </div>
              {isExpanded && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb", fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Mark scheme</div>
                  {markScheme.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 20, color: "#4b5563" }}>
                      {markScheme.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: "#6b7280" }}>—</span>
                  )}
                  {q.assets && q.assets.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
                      {q.assets.length} asset{q.assets.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
