/**
 * PR-PAST-PAPERS-UI-2: Topic breakdown for a past paper (counts + display names from taxonomy).
 */
import React from "react";
import type { PastPaperQuestionItem } from "../../api/pastPaperQuestions";
import { getTaxonomyKeyToTopic, type TaxonomyResponse } from "../../api/taxonomy";

function topicSlugFromStoredKey(storedKey: string): string {
  if (!storedKey) return "";
  const i = storedKey.indexOf(":");
  return i >= 0 ? storedKey.slice(i + 1) : storedKey;
}

function topicDisplayName(slug: string, taxonomy: TaxonomyResponse | null): string {
  if (!taxonomy) return slug;
  return getTaxonomyKeyToTopic(taxonomy)[slug] || slug;
}

type Props = {
  items: PastPaperQuestionItem[];
  taxonomy: TaxonomyResponse | null;
};

export function PastPaperTopicsSummary({ items, taxonomy }: Props) {
  const bySlug = new Map<string, number>();
  for (const q of items) {
    const slug = topicSlugFromStoredKey(q.topicKey);
    if (slug) bySlug.set(slug, (bySlug.get(slug) || 0) + 1);
  }
  const entries = Array.from(bySlug.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  if (entries.length === 0) return null;

  return (
    <div style={{ marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Linked topics</div>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#4b5563" }}>
        {entries.map(([slug, count]) => (
          <li key={slug}>
            {topicDisplayName(slug, taxonomy)} — {count} question{count !== 1 ? "s" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
