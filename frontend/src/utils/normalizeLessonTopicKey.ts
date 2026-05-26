/**
 * Map imported / free-text topic labels to valid taxonomy slugs (e.g. photosynthesis).
 * Mirrors backend/utils/normalizeLessonTopicKey.js — keep alias rules in sync.
 */
import { getSpecKeyFromLesson } from "./resolveLessonTopicKey";
import type { TaxonomyUnit } from "../api/taxonomy";
import { resolveTopicLabelFromUnits } from "./resolveTopicLabelToKey";

const PHOTOSYNTHESIS_RE = /\bphotosynth(?:esis|etic)\b/i;
const RESPIRATION_RE = /\b(?:aerobic|anaerobic)?\s*respiration\b/i;

function safeStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

export function normalizeTopicString(raw = ""): string {
  return safeStr(raw)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalSlugFromText(raw: string): string | null {
  const t = normalizeTopicString(raw);
  if (!t) return null;
  if (PHOTOSYNTHESIS_RE.test(t)) return "photosynthesis";
  if (/\bbioenergetics\b/.test(t) && /\bphoto/.test(t)) return "photosynthesis";
  if (t.includes("photosynthesis")) return "photosynthesis";
  if (RESPIRATION_RE.test(t)) return "respiration";
  if (/\baerobic\b/.test(t) && /\banaerobic\b/.test(t)) return "respiration";
  if (t.includes("respiration")) return "respiration";
  if (/\bresponse to exercise\b/.test(t)) return "response-to-exercise";
  return null;
}

export function extractTopicSlug(topicKeyRaw: string | null | undefined): string {
  const raw = safeStr(topicKeyRaw);
  if (!raw) return "";
  const colon = raw.indexOf(":");
  if (colon >= 0) return raw.slice(colon + 1).trim();
  return raw;
}

/** Slug looks like a slugified lesson title, not a syllabus sub-topic key. */
export function isLikelyInvalidTopicSlug(slug: string): boolean {
  const s = safeStr(slug).toLowerCase();
  if (!s) return true;
  if (s.length > 48) return true;
  if (/\b(aqa|gcse|ocr|edexcel|wjec)\b/.test(s) && s.split("-").length >= 4) return true;
  if (/\b(foundation|higher)(-tier)?\b/.test(s)) return true;
  return false;
}

export type NormalizeLessonTopicFields = {
  topicKey?: string | null;
  canonicalTopicKey?: string | null;
  title?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  specKey?: string | null;
  examBoardName?: string | null;
  level?: string | null;
  subject?: string | null;
};

/**
 * Best-effort canonical slug for a lesson (client-side; server re-validates on save).
 */
export function normalizeLessonTopicSlug(
  specKey: string,
  fields: NormalizeLessonTopicFields = {},
  taxonomyUnits?: TaxonomyUnit[]
): { slug: string | null; namespaced: string | null; repaired: boolean } {
  const spec = safeStr(specKey);
  if (!spec) return { slug: null, namespaced: null, repaired: false };

  const canonicalHint = safeStr(fields.canonicalTopicKey);
  const rawSlug = extractTopicSlug(fields.topicKey);
  const title = safeStr(fields.title);
  const topic = safeStr(fields.topic) || safeStr(fields.subTopic);

  const fromAlias =
    canonicalSlugFromText(canonicalHint) ||
    canonicalSlugFromText(rawSlug) ||
    canonicalSlugFromText(topic) ||
    canonicalSlugFromText(title);

  const repaired =
    Boolean(fromAlias && fromAlias !== rawSlug) ||
    Boolean(rawSlug && isLikelyInvalidTopicSlug(rawSlug));

  let slug =
    (canonicalHint && !isLikelyInvalidTopicSlug(canonicalHint) ? canonicalHint : null) ||
    fromAlias ||
    (rawSlug && !isLikelyInvalidTopicSlug(rawSlug) ? rawSlug : null);

  if (!slug && taxonomyUnits?.length) {
    const fromTaxonomy = resolveTopicLabelFromUnits(
      taxonomyUnits,
      fields.subTopic,
      fields.topic,
      fields.title,
      fields.canonicalTopicKey,
      fields.topicKey
    );
    if (fromTaxonomy.key) slug = fromTaxonomy.key;
  }

  if (!slug) return { slug: null, namespaced: null, repaired };

  return {
    slug,
    namespaced: `${spec}:${slug}`,
    repaired: repaired || Boolean(rawSlug && rawSlug !== slug),
  };
}

export function normalizeLessonTopicSlugFromLesson(
  lesson: NormalizeLessonTopicFields | null,
  taxonomyUnits?: TaxonomyUnit[]
): { slug: string | null; namespaced: string | null; repaired: boolean } {
  if (!lesson) return { slug: null, namespaced: null, repaired: false };
  const specKey =
    safeStr(lesson.specKey) || getSpecKeyFromLesson(lesson) || "";
  return normalizeLessonTopicSlug(specKey, lesson, taxonomyUnits);
}
