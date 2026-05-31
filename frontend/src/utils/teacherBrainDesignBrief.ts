import { normalizeBlockType } from "../types/lessonBlocks";

/** Must match `lib/teacherBrain/diagramBriefInjector.js` BRIEF_MARKER. */
export const TEACHER_BRAIN_DESIGN_BRIEF_MARKER = "--- TEACHER BRAIN DESIGN BRIEF ---";

const ELIGIBLE_BLOCK_TYPES = new Set([
  "interactiveDiagram",
  "dragDropMatch",
  "interactiveSequence",
]);

export function hasTeacherBrainDesignBrief(note: string | null | undefined): boolean {
  const text = String(note ?? "").trim();
  return text.startsWith(TEACHER_BRAIN_DESIGN_BRIEF_MARKER);
}

const BRIEF_KIND_HEADING =
  /^(DRAG & DROP BRIEF|TEXT → IMAGE DESIGN BRIEF|IMAGE \+ DROP ZONES DESIGN BRIEF|DIAGRAM BRIEF|STEP-BY-STEP BRIEF)/m;

/** Body shown in the panel (marker and kind heading omitted — kind shown in header). */
export function teacherBrainDesignBriefPanelText(note: string | null | undefined): string {
  const text = String(note ?? "").trim();
  if (!hasTeacherBrainDesignBrief(text)) return "";
  let rest = text.slice(TEACHER_BRAIN_DESIGN_BRIEF_MARKER.length).trimStart();
  const kind = rest.match(BRIEF_KIND_HEADING);
  if (kind) {
    rest = rest.slice(kind[0].length).trimStart();
  }
  return rest;
}

/** Subtitle under "Teacher Brain Design Brief" (e.g. TEXT → IMAGE DESIGN BRIEF). */
export function teacherBrainDesignBriefKindLine(note: string | null | undefined): string {
  const text = String(note ?? "").trim();
  if (!hasTeacherBrainDesignBrief(text)) return "";
  const rest = text.slice(TEACHER_BRAIN_DESIGN_BRIEF_MARKER.length).trimStart();
  const match = rest.match(BRIEF_KIND_HEADING);
  return match ? match[1].trim() : "";
}

/** Full note value for clipboard — entire stored note including marker. */
export function teacherBrainDesignBriefCopyText(note: string | null | undefined): string {
  return String(note ?? "").trim();
}

export function isTeacherBrainBriefEditorBlock(block: {
  type?: string;
  note?: string;
  mode?: string;
  role?: string;
}): boolean {
  const typeNorm = normalizeBlockType(String(block?.type ?? ""));
  if (ELIGIBLE_BLOCK_TYPES.has(typeNorm)) return true;
  if (typeNorm === "diagram" && hasTeacherBrainDesignBrief(block?.note)) return true;
  return false;
}

export function shouldShowTeacherBrainDesignBriefPanel(block: {
  type?: string;
  note?: string;
}): boolean {
  return isTeacherBrainBriefEditorBlock(block) && hasTeacherBrainDesignBrief(block?.note);
}

/** Hide note from generic editor fields — brief is shown only in the purple panel. */
export function shouldHideNoteFromGenericEditorField(
  note: string | null | undefined
): boolean {
  return hasTeacherBrainDesignBrief(note);
}
