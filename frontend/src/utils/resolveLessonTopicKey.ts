/**
 * PR-CONTENT-TARGETING-1: Resolve lesson topic key to canonical namespaced topicKeyForBank.
 * Format: "{specKey}:{topicSlug}". Do NOT slugify here — only namespace / validate.
 */

/** SpecKey type used for taxonomy (matches api/taxonomy). */
export type ResolveSpecKey =
  | "aqa-gcse-biology"
  | "aqa-gcse-chemistry"
  | "aqa-gcse-physics"
  | "aqa-gcse-maths-higher"
  | "aqa-gcse-english-language"
  | string;

/** Derive specKey from lesson metadata (same mapping as topic picker). */
export function getSpecKeyFromLesson(lesson: {
  examBoardName?: string | null;
  level?: string | null;
  subject?: string | null;
} | null): ResolveSpecKey | null {
  if (!lesson) return null;
  const board = (lesson.examBoardName || "").trim();
  const level = (lesson.level || "").trim();
  const sub = (lesson.subject || "").trim().toLowerCase();
  if (level !== "GCSE") return null;
  // Explicit AQA or empty board (derive AQA for UK GCSE when subject matches)
  const isAqa = board === "AQA" || board === "";
  if (!isAqa) return null;
  if (sub === "biology") return "aqa-gcse-biology";
  if (sub === "chemistry") return "aqa-gcse-chemistry";
  if (sub === "physics") return "aqa-gcse-physics";
  if (sub === "mathematics" || sub === "maths") return "aqa-gcse-maths-higher";
  if (sub === "english") return "aqa-gcse-english-language";
  return null;
}

export function resolveLessonTopicKeyForBank(params: {
  specKey: string | null | undefined;
  topicKeyCandidate: string | null | undefined;
}): string | null {
  const { specKey, topicKeyCandidate } = params;
  if (!specKey || !topicKeyCandidate) return null;
  const s = String(specKey).trim();
  const c = String(topicKeyCandidate).trim();
  if (!s || !c) return null;

  // If already namespaced, keep only if prefix matches specKey
  if (c.includes(":")) {
    const prefix = c.slice(0, c.indexOf(":"));
    if (prefix === s) return c;
    return null;
  }

  return `${s}:${c}`;
}

/**
 * Resolve topicKeyForBank from a lesson (for edit page / any page with lesson only).
 * Uses lesson.topicKey or slugified lesson.topic. Optional urlTopicKey overrides (e.g. from browse).
 */
export function resolveLessonTopicKeyForBankFromLesson(
  lesson: {
    topicKey?: string | null;
    specKey?: string | null;
    topic?: string | null;
    examBoardName?: string | null;
    level?: string | null;
    subject?: string | null;
  } | null,
  urlTopicKey?: string | null
): string | null {
  if (!lesson) return null;
  const specKey =
    (typeof (lesson as { specKey?: string }).specKey === "string" && (lesson as { specKey?: string }).specKey.trim())
      ? (lesson as { specKey?: string }).specKey!.trim()
      : getSpecKeyFromLesson(lesson);
  if (!specKey) return null;
  const raw =
    urlTopicKey?.trim() ||
    (typeof lesson.topicKey === "string" && lesson.topicKey.trim() ? lesson.topicKey.trim() : null) ||
    (typeof lesson.topic === "string" && lesson.topic.trim()
      ? lesson.topic.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "")
      : null);
  return resolveLessonTopicKeyForBank({ specKey, topicKeyCandidate: raw || undefined });
}
