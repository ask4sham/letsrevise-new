/**
 * Display-only lesson catalog metadata labels.
 * Does not mutate stored taxonomy (board/level/tier/specKey/topicKey).
 */

import { getSpecIdentity } from "./specIdentity";

export type LessonMetadataDisplayInput = {
  topic?: string | null;
  level?: string | null;
  tier?: string | null;
  subject?: string | null;
  specKey?: string | null;
  examBoardName?: string | null;
  board?: string | null;
  description?: string | null;
};

/** Mirrors frontend/src/api/taxonomy SPEC_DISPLAY_LABELS (kept local to avoid api→axios in unit tests). */
const COURSE_DISPLAY_LABELS: Record<string, string> = {
  "aqa-gcse-biology": "AQA GCSE Biology",
  "aqa-gcse-chemistry": "AQA GCSE Chemistry",
  "aqa-gcse-physics": "AQA GCSE Physics",
  "aqa-gcse-maths-foundation": "AQA GCSE Maths (Foundation)",
  "aqa-gcse-maths-higher": "AQA GCSE Maths (Higher)",
  "aqa-l2-further-maths": "AQA Further Maths (Level 2)",
  "aqa-gcse-english-literature": "AQA GCSE English Literature",
  "aqa-gcse-english-language": "AQA GCSE English Language",
  "edexcel-igcse-biology": "Edexcel IGCSE Biology",
};

function safeTrim(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function titleCaseToken(token: string): string {
  const t = token.trim();
  if (!t) return "";
  if (/^igcse$/i.test(t)) return "IGCSE";
  if (/^gcse$/i.test(t)) return "GCSE";
  if (/^aqa$/i.test(t)) return "AQA";
  if (/^edexcel$/i.test(t)) return "Edexcel";
  if (/^ocr$/i.test(t)) return "OCR";
  if (/^ks\d$/i.test(t)) return t.toUpperCase();
  if (/^l\d$/i.test(t)) return t.toUpperCase();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Humanise unknown spec keys: edexcel-igcse-biology → Edexcel IGCSE Biology */
export function humanizeSpecKey(specKey: string): string {
  return safeTrim(specKey)
    .split(/[-_]+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
}

function keyStageFromLevelToken(level: string): string | undefined {
  const s = safeTrim(level);
  if (!s || s === "Not set") return undefined;
  // Explicit key-stage values win (never treat these as course codes).
  if (/^KS3\b/i.test(s) || /\bkey\s*stage\s*3\b/i.test(s)) return "KS3";
  if (/^KS4\b/i.test(s) || /\bkey\s*stage\s*4\b/i.test(s)) return "KS4";
  if (/^KS5\b/i.test(s) || /\bkey\s*stage\s*5\b/i.test(s)) return "KS5";
  // Course / qualification codes → key stage (do not show IGCSE/GCSE as key stage).
  if (/\bigcse\b/i.test(s) || /\bgcse\b/i.test(s)) return "KS4";
  if (/\ba[\s-]?level\b/i.test(s) || /\bas[\s-]?level\b/i.test(s)) return "KS5";
  return undefined;
}

/**
 * Real key stage for display. Course codes (IGCSE/GCSE) map to KS4;
 * never return IGCSE/GCSE as the key-stage label.
 * Prefer an explicit KS3/KS4/KS5 on lesson.level over spec-identity course level.
 */
export function displayKeyStageLabel(
  input: Pick<LessonMetadataDisplayInput, "level" | "specKey">
): string | undefined {
  const rawLevel = safeTrim(input.level);
  if (/^KS[345]\b/i.test(rawLevel) || /\bkey\s*stage\s*[345]\b/i.test(rawLevel)) {
    return keyStageFromLevelToken(rawLevel);
  }

  const identity = input.specKey ? getSpecIdentity(safeTrim(input.specKey)) : null;
  return (
    keyStageFromLevelToken(rawLevel) ||
    keyStageFromLevelToken(identity?.level || "") ||
    undefined
  );
}

/**
 * Course label from registered spec identity / display labels.
 * Falls back to a generic board + level + subject / humanised specKey.
 */
export function displayCourseLabel(
  input: Pick<
    LessonMetadataDisplayInput,
    "specKey" | "subject" | "level" | "examBoardName" | "board"
  >
): string | undefined {
  const specKey = safeTrim(input.specKey);
  if (specKey) {
    const known = COURSE_DISPLAY_LABELS[specKey];
    if (known) return known;

    const identity = getSpecIdentity(specKey);
    const subject = safeTrim(input.subject);
    if (identity && subject && subject !== "Not set") {
      return `${identity.board} ${identity.level} ${subject}`;
    }
    return humanizeSpecKey(specKey);
  }

  const board = safeTrim(input.examBoardName || input.board);
  const level = safeTrim(input.level);
  const subject = safeTrim(input.subject);
  if (
    board &&
    level &&
    subject &&
    subject !== "Not set" &&
    !/^KS\d$/i.test(level) &&
    !/\bkey\s*stage\b/i.test(level)
  ) {
    return `${board} ${level} ${subject}`;
  }
  return undefined;
}

export function displayTierLabel(tier: string | null | undefined): string | undefined {
  const t = safeTrim(tier).toLowerCase();
  if (!t) return undefined;
  if (t === "higher") return "Higher";
  if (t === "foundation") return "Foundation";
  return safeTrim(tier);
}

export function isCatalogMetaDescription(description: string): boolean {
  const s = safeTrim(description);
  if (!s) return false;
  if (!/^Topic:\s*/i.test(s)) return false;
  if (!/Key stage:/i.test(s) && !/·\s*Tier:/i.test(s) && !/·\s*Course:/i.test(s)) {
    return false;
  }
  // Reject long prose that merely mentions "Topic:" somewhere.
  if (s.length > 280) return false;
  return /^Topic:/i.test(s) && /·/.test(s);
}

function topicFromCatalogMeta(description: string): string | undefined {
  const m = safeTrim(description).match(/^Topic:\s*([^·]+?)(?:\s*·|$)/i);
  const topic = m?.[1]?.trim();
  return topic || undefined;
}

function tierFromCatalogMeta(description: string): string | undefined {
  const m = safeTrim(description).match(/Tier:\s*([^·]+)/i);
  return m?.[1]?.trim() || undefined;
}

/**
 * Build:
 * Topic: … · Key stage: KS4 · Course: Edexcel IGCSE Biology · Tier: Higher
 */
export function formatLessonMetadataDisplayLine(
  input: LessonMetadataDisplayInput
): string | null {
  const topic = safeTrim(input.topic);
  if (!topic || topic === "Not set") return null;

  const keyStage = displayKeyStageLabel(input);
  let course = displayCourseLabel(input);

  // KS3 must not show GCSE/IGCSE course labels incorrectly.
  if (keyStage === "KS3" && course && /\b(IGCSE|GCSE)\b/i.test(course)) {
    course = undefined;
  }

  const tier = displayTierLabel(input.tier);

  return [
    `Topic: ${topic}`,
    keyStage ? `Key stage: ${keyStage}` : "",
    course ? `Course: ${course}` : "",
    tier ? `Tier: ${tier}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * If the stored description is import catalog metadata, rewrite for display.
 * Prose descriptions pass through unchanged. Never mutates stored fields.
 */
export function resolveLessonDescriptionForDisplay(
  description: string,
  lesson: LessonMetadataDisplayInput
): string {
  const raw = safeTrim(description);
  if (!raw) return raw;
  if (!isCatalogMetaDescription(raw)) return raw;

  const topic =
    safeTrim(lesson.topic) && safeTrim(lesson.topic) !== "Not set"
      ? safeTrim(lesson.topic)
      : topicFromCatalogMeta(raw);
  const tier = safeTrim(lesson.tier) || tierFromCatalogMeta(raw);

  return (
    formatLessonMetadataDisplayLine({
      ...lesson,
      topic,
      tier,
    }) || raw
  );
}
