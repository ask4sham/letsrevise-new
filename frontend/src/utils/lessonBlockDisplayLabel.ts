import { BLOCK_META, type LessonBlockType } from "../types/lessonBlocks";
import { normalizeLegacyBlockLabel, normalizeLegacySs1Heading } from "./formatBlockHeading";

const NUMBERED_BLOCK_TITLE_RE = /^\d+\s*[\u2014\u2013\-]\s+\S/;

/** Editor chrome: prefer generator SS1 title (`3 — Core teaching`) else `n — Block type`. */
export function lessonBlockDisplayLabel(
  blockType: LessonBlockType,
  blockIndex: number,
  title?: unknown
): string {
  const t = typeof title === "string" ? title.trim() : "";
  if (NUMBERED_BLOCK_TITLE_RE.test(t)) return normalizeLegacySs1Heading(t);
  const base = BLOCK_META[blockType]?.label ?? blockType;
  return `${blockIndex + 1} — ${base}`;
}
