/**
 * Resolve free-text / composite lesson labels to canonical taxonomy topic keys.
 * Keep matching rules in sync with backend/utils/resolveTopicLabelToKey.js
 */
import type { TaxonomyUnit } from "../api/taxonomy";
import { getUnitTopics } from "../api/taxonomy";
import { normalizeTopicString } from "./normalizeLessonTopicKey";

export type TopicLabelMatch =
  | "exact-display"
  | "normalized-display"
  | "slug"
  | "alias"
  | "fuzzy-contains";

export type ResolveTopicLabelResult = {
  key: string | null;
  match: TopicLabelMatch | null;
  candidate: string | null;
};

function safeStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

export function topicToKey(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractLabelCandidates(...sources: unknown[]): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const t = safeStr(s);
    if (!t) return;
    if (!out.includes(t)) out.push(t);
  };

  for (const source of sources) {
    const raw = safeStr(source);
    if (!raw) continue;
    add(raw);
    const noParens = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    add(noParens);
    for (const part of noParens.split(/[ÔÇôÔÇö|:]/)) {
      add(part.trim());
    }
    const emParts = noParens.split(/\s+[ÔÇôÔÇö]\s+/);
    if (emParts.length > 1) {
      add(emParts[emParts.length - 1].trim());
    }
  }
  return out;
}

function normalizeDisplayLabel(label: string): string {
  return normalizeTopicString(label);
}

function aliasSlugFromNormalized(normalized: string): string | null {
  const t = normalizeDisplayLabel(normalized);
  if (!t) return null;
  if (/\bphotosynth(?:esis|etic)\b/.test(t)) return "photosynthesis";
  if (/\bbioenergetics\b/.test(t) && /\bphoto/.test(t)) return "photosynthesis";
  if (t.includes("photosynthesis")) return "photosynthesis";
  if (/\b(?:aerobic|anaerobic)?\s*respiration\b/.test(t)) return "respiration";
  if (/\baerobic\b/.test(t) && /\banaerobic\b/.test(t)) return "respiration";
  if (t.includes("respiration")) return "respiration";
  if (/\blimiting factor/.test(t)) return "photosynthesis";
  if (/\buses of glucose\b/.test(t)) return "photosynthesis";
  if (/\bmetabolism\b/.test(t) && !/\benzyme/.test(t)) return "metabolism";
  return null;
}

function flattenTopics(units: TaxonomyUnit[] | undefined) {
  const topics: Array<{ topic?: string; key?: string }> = [];
  if (!units) return topics;
  for (const u of units) {
    for (const t of getUnitTopics(u)) topics.push(t);
  }
  return topics;
}

function matchCandidateAgainstTopics(
  topics: Array<{ topic?: string; key?: string }>,
  candidate: string
): { key: string; match: TopicLabelMatch } | null {
  const c = safeStr(candidate);
  if (!c || !topics.length) return null;
  const normC = normalizeDisplayLabel(c);
  const slugC = topicToKey(c);

  for (const t of topics) {
    const display = safeStr(t.topic);
    const key = safeStr(t.key);
    if (!key) continue;
    if (display && display.toLowerCase() === c.toLowerCase()) {
      return { key, match: "exact-display" };
    }
  }

  for (const t of topics) {
    const display = safeStr(t.topic);
    const key = safeStr(t.key);
    if (!key || !display) continue;
    if (normalizeDisplayLabel(display) === normC) {
      return { key, match: "normalized-display" };
    }
  }

  if (slugC) {
    for (const t of topics) {
      const key = safeStr(t.key);
      if (key && key.toLowerCase() === slugC) {
        return { key, match: "slug" };
      }
    }
  }

  const alias = aliasSlugFromNormalized(normC);
  if (alias) {
    for (const t of topics) {
      const key = safeStr(t.key);
      if (key === alias) return { key, match: "alias" };
    }
  }

  if (normC.length >= 4) {
    let best: { key: string; match: TopicLabelMatch; display: string } | null = null;
    for (const t of topics) {
      const display = safeStr(t.topic);
      const key = safeStr(t.key);
      if (!display || !key) continue;
      const normD = normalizeDisplayLabel(display);
      if (normD.includes(normC) || normC.includes(normD)) {
        if (!best || normD.length < normalizeDisplayLabel(best.display).length) {
          best = { key, match: "fuzzy-contains", display };
        }
      }
    }
    if (best) return { key: best.key, match: best.match };
  }

  return null;
}

export function resolveTopicLabelFromUnits(
  units: TaxonomyUnit[] | undefined,
  ...labelSources: unknown[]
): ResolveTopicLabelResult {
  const topics = flattenTopics(units);
  if (!topics.length) return { key: null, match: null, candidate: null };
  const candidates = extractLabelCandidates(...labelSources);
  for (const candidate of candidates) {
    const hit = matchCandidateAgainstTopics(topics, candidate);
    if (hit) return { key: hit.key, match: hit.match, candidate };
  }
  return { key: null, match: null, candidate: candidates[0] || null };
}

export function logTopicMappingDebug(scope: string, payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  // eslint-disable-next-line no-console
  console.debug(`[topic-mapping:${scope}]`, payload);
}
