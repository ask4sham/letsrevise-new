/**
 * PR — Adaptive Testing Loop: get the next topic key in syllabus order.
 * Used for "Continue to next lesson" when mastery is strong.
 */
import { useMemo } from "react";
import { useTaxonomy } from "./useTaxonomy";
import type { SpecKey } from "../api/taxonomy";
import { getTaxonomyTopicsFlat } from "../api/taxonomy";

function topicKeyWithoutSpecPrefix(key: string): string {
  const s = (key || "").trim();
  if (!s) return "";
  return s.includes(":") ? s.split(":").slice(1).join(":").trim() : s;
}

/**
 * Returns the next topic key in syllabus order (full key with spec prefix), or null if current is last or not found.
 */
export function useNextTopicKey(specKey: SpecKey | string, currentTopicKey: string | null): string | null {
  const { data: taxonomy } = useTaxonomy(specKey as any);

  return useMemo(() => {
    if (!taxonomy?.units?.length || !currentTopicKey?.trim()) return null;
    const ordered = getTaxonomyTopicsFlat(taxonomy).map((t) => ({
      key: (t.key ?? "").trim(),
    }));
    const currentRaw = topicKeyWithoutSpecPrefix(currentTopicKey);
    if (!currentRaw) return null;
    const index = ordered.findIndex((t) => t.key === currentRaw || topicKeyWithoutSpecPrefix(t.key) === currentRaw);
    if (index < 0 || index + 1 >= ordered.length) return null;
    let nextKey = ordered[index + 1]?.key ?? null;
    if (!nextKey) return null;
    if (!nextKey.includes(":")) nextKey = `${specKey}:${nextKey}`;
    return nextKey;
  }, [taxonomy, currentTopicKey, specKey]);
}
