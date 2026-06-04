/**
 * Diagram block display: instructions (once above), source caption below, hidden reveals.
 * Does not mutate stored lesson data.
 */

import { cleanDiagramInstructionsForDisplay } from "./cleanDiagramInstructionsForDisplay";
import {
  formatStudentBlockHeading,
  SS1_NUMBERED_TITLE_PREFIX_RE,
  stripSs1PrefixFromTitle,
} from "./formatBlockHeading";

export type DiagramRevealDisplay = {
  summary: string;
  body: string;
};

export type DiagramPedagogyDisplay = {
  title?: string;
  /** Student task / question shown above the diagram */
  visibleInstructions?: string;
  /** Model answer in accordion (not shown until expanded) */
  hiddenAnswer?: DiagramRevealDisplay;
  caption?: string;
  /** @deprecated Use visibleInstructions */
  instructions?: string;
  /** @deprecated Use hiddenAnswer */
  reveal?: DiagramRevealDisplay;
};

const TEACHING_PROSE_MARKERS =
  /\b(central idea|think like an examiner|what actually happens|structure\s*→|why this matters|common slip|exam technique|in short)\b/i;

/** Student-facing diagram copy must start with one of these markers (case-insensitive). */
export const EXPLICIT_DIAGRAM_STUDENT_MARKER_RE =
  /(?:^|\n)\s*(?:task|diagram\s+task|instruction|student\s+task)\s*:/i;

const STUDENT_TASK_MARKERS =
  /\b(task:|trace the journey|using the diagram|on the diagram|then explain|how does|how do|what role|your task)\b/i;

const TASK_ACTION_BULLET_RE =
  /^\s*-\s+.*\b(identify|name|label|describe|explain|state|sketch|draw|annotate|trace|complete)\b/im;

const SOURCE_CAPTION_MARKERS =
  /^(source|credit|figure|image|diagram|photo|©|copyright|adapted from|based on)/i;

const BLOCK_ROLE_TITLE_RE =
  /^(core\s+learning|lesson\s+objectives|prior\s+knowledge|scenario|core\s+rule|summary|key\s+words|exam\s+practice|common\s+mistake|exam\s+technique)$/i;

const ANSWER_MATERIAL_RE =
  /\b(reveal\s+answer|model\s+answer|answer\s+key|mark\s+scheme)\b/i;

const HOTSPOT_ANSWER_LINE_RE = /^[A-Z]\s*→\s*.+/m;

function blockRecord(block: unknown): Record<string, unknown> {
  return block != null && typeof block === "object" ? (block as Record<string, unknown>) : {};
}

const PEDAGOGY_BODY_FIELD_KEYS = ["subtitle", "intro", "note", "content"] as const;

function normalizeCompare(text: string): string {
  return cleanDiagramInstructionsForDisplay(text).replace(/\s+/g, " ").trim().toLowerCase();
}

/** Compare keys for duplicate task/caption detection (strips diagram boilerplate). */
function pedagogyCompareKey(text: string): string {
  return normalizeCompare(text)
    .replace(/\s+on the diagram\.?$/i, "")
    .replace(/\s+on this diagram\.?$/i, "")
    .replace(/\.\s*$/g, "")
    .trim();
}

/** Normalise titles for duplicate detection (case, punctuation, whitespace). */
export function normalizePedagogyTitleCompareKey(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[\u2014\u2013\u2012\u2212\-–—:;.,!?'"()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blockHeadingTitleCandidates(block: Record<string, unknown>): string[] {
  const out: string[] = [];
  const rawTitle = fieldTrim(block, "title");
  if (rawTitle) {
    out.push(rawTitle);
    out.push(stripSs1PrefixFromTitle(rawTitle));
  }
  const heading = formatStudentBlockHeading(block);
  if (heading) {
    out.push(heading);
    const m = heading.match(SS1_NUMBERED_TITLE_PREFIX_RE);
    if (m?.[2]) out.push(String(m[2]).trim());
  }
  return out;
}

/** True when diagram pedagogy title repeats the lesson block heading label. */
export function pedagogyTitleDuplicatesBlockHeading(
  block: unknown,
  pedagogyTitle: string | undefined
): boolean {
  if (!pedagogyTitle?.trim()) return false;
  const pedKey = normalizePedagogyTitleCompareKey(pedagogyTitle);
  if (!pedKey) return false;

  const seen = new Set<string>();
  for (const candidate of blockHeadingTitleCandidates(blockRecord(block))) {
    const key = normalizePedagogyTitleCompareKey(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (key === pedKey) return true;
  }
  return false;
}

function cleanedPedagogyField(block: Record<string, unknown>, key: string): string {
  const raw = fieldTrim(block, key);
  if (!raw || /^image\s+here$/i.test(raw)) return "";
  const { remainder } = extractDiagramRevealSections(raw);
  return cleanDiagramInstructionsForDisplay(remainder);
}

/** True when any diagram body field is migrated teaching HTML (not a short student task). */
export function blockHasDiagramTeachingProse(block: unknown): boolean {
  const b = blockRecord(block);
  for (const key of PEDAGOGY_BODY_FIELD_KEYS) {
    const cleaned = cleanedPedagogyField(b, key);
    if (cleaned && isDiagramTeachingProse(cleaned)) return true;
  }
  return false;
}

export function hasExplicitDiagramStudentMarker(text: string): boolean {
  return EXPLICIT_DIAGRAM_STUDENT_MARKER_RE.test(String(text ?? "").trim());
}

/** Text from the first Task / Instruction / Student task marker onward (teaching preamble above is omitted). */
export function extractExplicitDiagramStudentInstructions(cleaned: string): string | undefined {
  const t = cleaned.trim();
  if (!t || !hasExplicitDiagramStudentMarker(t)) return undefined;

  const markerIndex = t.search(EXPLICIT_DIAGRAM_STUDENT_MARKER_RE);
  if (markerIndex < 0) return undefined;

  let section = t.slice(markerIndex).trim();
  if (!section || containsDiagramAnswerMaterial(section)) return undefined;
  if (section.length > 4000) section = section.slice(0, 4000);
  return section;
}

function findExplicitDiagramInstruction(block: Record<string, unknown>): string | undefined {
  for (const key of PEDAGOGY_BODY_FIELD_KEYS) {
    const cleaned = cleanedPedagogyField(block, key);
    if (!cleaned) continue;
    const extracted = extractExplicitDiagramStudentInstructions(cleaned);
    if (extracted) return extracted;
  }
  return undefined;
}

/** True when long teaching prose is stored but no explicit student Task/Instruction marker. */
export function diagramInstructionsHiddenFromStudents(block: unknown): boolean {
  if (!blockHasDiagramTeachingProse(block)) return false;
  const b = blockRecord(block);
  for (const key of PEDAGOGY_BODY_FIELD_KEYS) {
    const cleaned = cleanedPedagogyField(b, key);
    if (cleaned && hasExplicitDiagramStudentMarker(cleaned)) return false;
  }
  return true;
}

function isDiagramTaskLikeCaption(cleaned: string): boolean {
  const t = cleaned.trim();
  if (!t || t.length > 120) return false;
  if (SOURCE_CAPTION_MARKERS.test(t)) return false;
  return /^(label|identify|name|describe|explain|annotate|draw|list|state|sketch|study|using|complete)\b/i.test(
    t
  );
}

function fieldTrim(block: Record<string, unknown>, key: string): string {
  const v = block[key];
  return typeof v === "string" ? v.trim() : "";
}

/** Extract <details> reveal sections; returns stripped remainder. */
export function extractDiagramRevealSections(raw: string): {
  remainder: string;
  reveals: DiagramRevealDisplay[];
} {
  let text = String(raw ?? "");
  const reveals: DiagramRevealDisplay[] = [];

  text = text.replace(/<details[^>]*>([\s\S]*?)<\/details>/gi, (_m, inner: string) => {
    const summaryMatch = inner.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    const summary = summaryMatch
      ? cleanDiagramInstructionsForDisplay(summaryMatch[1])
      : "Reveal answer";
    const body = cleanDiagramInstructionsForDisplay(
      inner.replace(/<summary[^>]*>[\s\S]*?<\/summary>/gi, "")
    );
    if (body) reveals.push({ summary: summary || "Reveal answer", body });
    return "";
  });

  const plainRevealRe =
    /(?:^|\n)\s*Reveal\s+Answer\s*:?\s*\n+([\s\S]+?)(?=\n\s*(?:Reveal\s+Answer|Answer\s+key|Model\s+answer|$))/gi;
  let plainMatch: RegExpExecArray | null;
  while ((plainMatch = plainRevealRe.exec(text)) !== null) {
    const body = cleanDiagramInstructionsForDisplay(plainMatch[1]);
    if (body) reveals.push({ summary: "Reveal answer", body });
  }
  if (/(?:^|\n)\s*Reveal\s+Answer\s*:?\s*\n+/i.test(text)) {
    text = text.replace(
      /(?:^|\n)\s*Reveal\s+Answer\s*:?\s*\n+[\s\S]+?(?=\n\s*(?:Reveal\s+Answer|Answer\s+key|Model\s+answer|$)|$)/gi,
      "\n"
    );
  }

  return { remainder: text.trim(), reveals };
}

export function containsDiagramAnswerMaterial(text: string): boolean {
  const t = cleanDiagramInstructionsForDisplay(text);
  if (!t) return false;
  if (ANSWER_MATERIAL_RE.test(t)) return true;
  if (HOTSPOT_ANSWER_LINE_RE.test(t)) return true;
  return false;
}

/** True when cleaned text includes an explicit student-facing diagram marker. */
export function isDiagramStudentTask(cleaned: string): boolean {
  return hasExplicitDiagramStudentMarker(cleaned);
}

export function isDiagramTeachingProse(cleaned: string): boolean {
  const t = cleaned.trim();
  if (!t) return false;
  if (isDiagramStudentTask(t)) return false;
  if (t.length > 320) return true;
  const bulletCount = (t.match(/^\s*-\s+/gm) ?? []).length;
  if (bulletCount >= 3) return true;
  if (TEACHING_PROSE_MARKERS.test(t)) return true;
  const headingCount = (t.match(/^[A-Z][^\n]{0,60}$/gm) ?? []).filter((h) => h.length > 8).length;
  if (headingCount >= 2 && t.length > 120) return true;
  return false;
}

export function isDiagramBlockRoleTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (BLOCK_ROLE_TITLE_RE.test(t)) return true;
  if (/^\d+\s*[a-z]?\s*[—–-]\s+/i.test(t)) return true;
  return false;
}

export function isValidDiagramSourceCaption(cleaned: string): boolean {
  const t = cleaned.trim();
  if (!t || t.length > 200) return false;
  if (containsDiagramAnswerMaterial(t)) return false;
  if (isDiagramTeachingProse(t)) return false;
  const bullets = (t.match(/^\s*-\s+/gm) ?? []).length;
  if (bullets >= 2) return false;
  if (t.length <= 80) return true;
  if (SOURCE_CAPTION_MARKERS.test(t)) return true;
  return false;
}

/** Visible student task text — only when explicitly marked (Task / Instruction / etc.). */
export function extractVisibleInstructionsFromCleaned(cleaned: string): string | undefined {
  const t = cleaned.trim();
  if (!t) return undefined;
  if (SOURCE_CAPTION_MARKERS.test(t) && !hasExplicitDiagramStudentMarker(t)) {
    return undefined;
  }
  return extractExplicitDiagramStudentInstructions(t);
}

function parseFieldForVisibleAndReveal(raw: string): {
  visibleInstructions?: string;
  reveals: DiagramRevealDisplay[];
} {
  const { remainder, reveals } = extractDiagramRevealSections(raw);
  const cleaned = cleanDiagramInstructionsForDisplay(remainder);
  const visibleInstructions = extractVisibleInstructionsFromCleaned(cleaned);
  return { visibleInstructions, reveals };
}

/** Plain-text authoring shape for save/export (task + optional reveal, no HTML). */
export function normalizeDiagramPedagogyAuthoringForPersist(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";

  const { remainder, reveals } = extractDiagramRevealSections(trimmed);
  const visible = cleanDiagramInstructionsForDisplay(remainder);
  const parts: string[] = [];
  if (visible) parts.push(visible);
  for (const r of reveals) {
    if (!r.body.trim()) continue;
    const summary = r.summary.trim() || "Reveal answer";
    parts.push(`${summary}\n\n${r.body.trim()}`);
  }
  return parts.join("\n\n").trim();
}

function textsSemanticallyDuplicate(a: string, b: string | undefined): boolean {
  if (!b?.trim()) return false;
  const na = pedagogyCompareKey(a);
  const nb = pedagogyCompareKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 10 && nb.length >= 10 && (na.includes(nb) || nb.includes(na))) return true;
  const minLen = Math.min(na.length, nb.length);
  const maxLen = Math.max(na.length, nb.length);
  if (minLen >= 12 && maxLen <= Math.ceil(minLen * 1.55)) {
    if (na.startsWith(nb) || nb.startsWith(na)) return true;
  }
  return false;
}

function collectAllCleanedFieldTexts(block: Record<string, unknown>): string[] {
  const keys = ["subtitle", "intro", "note", "content", "caption", "title"] as const;
  const out: string[] = [];
  for (const key of keys) {
    const raw = fieldTrim(block, key);
    if (!raw || /^image\s+here$/i.test(raw)) continue;
    const { remainder } = extractDiagramRevealSections(raw);
    const cleaned = cleanDiagramInstructionsForDisplay(remainder);
    if (cleaned) out.push(cleaned);
  }
  return out;
}

function warnDiagramPedagogySuppressed(reason: string, block: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  const b = blockRecord(block);
  console.warn("[diagram-pedagogy]", reason, {
    type: b.type,
    title: fieldTrim(b, "title").slice(0, 80),
  });
}

/**
 * Unified student/editor display for diagram blocks.
 */
function pickRicherVisibleInstructions(
  current: string | undefined,
  candidate: string | undefined
): string | undefined {
  if (!candidate?.trim()) return current;
  if (!current?.trim()) return candidate.trim();
  return candidate.trim().length > current.trim().length ? candidate.trim() : current;
}

export function diagramPedagogyDisplayFromBlock(block: unknown): DiagramPedagogyDisplay {
  const b = blockRecord(block);
  const allReveals: DiagramRevealDisplay[] = [];
  let visibleInstructions: string | undefined;

  const teachingHeavy = blockHasDiagramTeachingProse(b);

  for (const key of PEDAGOGY_BODY_FIELD_KEYS) {
    const raw = fieldTrim(b, key);
    if (!raw || /^image\s+here$/i.test(raw)) continue;
    const { visibleInstructions: visible, reveals } = parseFieldForVisibleAndReveal(raw);
    allReveals.push(...reveals);
    if (!visible) continue;
    if (teachingHeavy && !isDiagramStudentTask(visible)) continue;
    visibleInstructions = pickRicherVisibleInstructions(visibleInstructions, visible);
  }

  if (!visibleInstructions && teachingHeavy) {
    visibleInstructions = findExplicitDiagramInstruction(b);
  }

  const titleRaw = fieldTrim(b, "title");
  const titleCleaned = titleRaw ? cleanDiagramInstructionsForDisplay(titleRaw) : undefined;
  let title =
    titleCleaned && !isDiagramBlockRoleTitle(titleCleaned) ? titleCleaned : undefined;
  if (title && pedagogyTitleDuplicatesBlockHeading(b, title)) {
    title = undefined;
  }

  let caption: string | undefined;
  const captionRaw = fieldTrim(b, "caption");
  if (captionRaw) {
    const { visibleInstructions: captionVisible, reveals } = parseFieldForVisibleAndReveal(captionRaw);
    allReveals.push(...reveals);
    if (
      captionVisible &&
      isDiagramStudentTask(captionVisible) &&
      !textsSemanticallyDuplicate(captionVisible, titleCleaned)
    ) {
      visibleInstructions = pickRicherVisibleInstructions(visibleInstructions, captionVisible);
    }

    const { remainder } = extractDiagramRevealSections(captionRaw);
    const cleaned = cleanDiagramInstructionsForDisplay(remainder);
    const taskLikeWithInstructions = Boolean(
      visibleInstructions && isDiagramTaskLikeCaption(cleaned)
    );
    if (
      cleaned &&
      isValidDiagramSourceCaption(cleaned) &&
      !taskLikeWithInstructions &&
      !textsSemanticallyDuplicate(cleaned, visibleInstructions) &&
      !textsSemanticallyDuplicate(cleaned, title)
    ) {
      caption = cleaned;
    } else if (cleaned && containsDiagramAnswerMaterial(cleaned)) {
      warnDiagramPedagogySuppressed("answer material in caption suppressed", block);
    } else if (cleaned && !isValidDiagramSourceCaption(cleaned)) {
      if (
        textsSemanticallyDuplicate(cleaned, visibleInstructions) ||
        textsSemanticallyDuplicate(cleaned, title)
      ) {
        /* expected duplicate */
      } else if (isDiagramTeachingProse(cleaned)) {
        warnDiagramPedagogySuppressed("teaching prose in caption suppressed", block);
      }
    }
  }

  const noteRaw = fieldTrim(b, "note");
  if (!caption && noteRaw && !textsSemanticallyDuplicate(noteRaw, visibleInstructions)) {
    const { remainder, reveals } = extractDiagramRevealSections(noteRaw);
    allReveals.push(...reveals);
    const cleaned = cleanDiagramInstructionsForDisplay(remainder);
    if (cleaned && isValidDiagramSourceCaption(cleaned)) caption = cleaned;
  }

  const hiddenAnswer = allReveals.find((r) => r.body.trim()) ?? undefined;
  if (hiddenAnswer && !caption) {
    warnDiagramPedagogySuppressed("answer reveal extracted; not shown as open caption", block);
  }

  if (caption && pedagogyTitleDuplicatesBlockHeading(b, caption)) {
    caption = undefined;
  }

  const allTexts = collectAllCleanedFieldTexts(b);
  if (caption) {
    for (const other of allTexts) {
      if (other !== caption && textsSemanticallyDuplicate(caption, other)) {
        caption = undefined;
        break;
      }
    }
  }

  const display: DiagramPedagogyDisplay = {
    ...(title && !textsSemanticallyDuplicate(title, visibleInstructions) ? { title } : {}),
    ...(visibleInstructions && !textsSemanticallyDuplicate(visibleInstructions, title)
      ? { visibleInstructions }
      : {}),
    ...(caption ? { caption } : {}),
    ...(hiddenAnswer ? { hiddenAnswer } : {}),
  };
  if (display.visibleInstructions) display.instructions = display.visibleInstructions;
  if (display.hiddenAnswer) display.reveal = display.hiddenAnswer;
  return display;
}

/** @deprecated Use diagramPedagogyDisplayFromBlock */
export function diagramInstructionsForDisplayFromBlock(block: unknown): string | undefined {
  const d = diagramPedagogyDisplayFromBlock(block);
  return d.visibleInstructions ?? d.instructions;
}

/** @deprecated Use diagramPedagogyDisplayFromBlock */
export function diagramCaptionForDisplayFromBlock(block: unknown): string | undefined {
  return diagramPedagogyDisplayFromBlock(block).caption;
}

export function isDuplicateDiagramPedagogyText(
  candidate: string,
  instructionsAbove: string | undefined
): boolean {
  return textsSemanticallyDuplicate(candidate, instructionsAbove);
}

export function cleanDiagramPedagogyFieldForDisplay(input: unknown): string {
  return cleanDiagramInstructionsForDisplay(input);
}

export {
  diagramInstructionSourceField,
  diagramInstructionsRawFromBlock,
  type DiagramInstructionSourceField,
} from "./cleanDiagramInstructionsForDisplay";
