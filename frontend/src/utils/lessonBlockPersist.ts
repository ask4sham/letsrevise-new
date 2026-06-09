import { graphBlockForPersist } from "../components/lesson/graphBlockTypes";
import {
  diagramInstructionsForDisplayFromBlock,
  normalizeDiagramPedagogyAuthoringForPersist,
} from "./diagramPedagogyDisplay";
import { sanitizeTeacherMarkdown } from "./lessonTeacherMarkdown";

export {
  diagramCaptionForDisplayFromBlock,
  diagramInstructionsForDisplayFromBlock,
  diagramInstructionsHiddenFromStudents,
  diagramPedagogyDisplayFromBlock,
  diagramPedagogyRenderFromBlock,
} from "./diagramPedagogyDisplay";

function blockRecord(block: unknown): Record<string, unknown> {
  return block != null && typeof block === "object" ? (block as Record<string, unknown>) : {};
}

/** Teacher-only block note (e.g. Teacher Brain design brief) — round-trip on save/load. */
export function blockNoteForPersist(note: unknown): string | undefined {
  const s = String(note ?? "").trim();
  return s || undefined;
}

export type BlockWithOptionalNote<T extends Record<string, unknown>> = T & {
  note?: string;
};

export function withPersistedBlockNote<T extends Record<string, unknown>>(
  out: T,
  source: { note?: unknown }
): BlockWithOptionalNote<T> {
  const note = blockNoteForPersist(source.note);
  if (!note) return out as BlockWithOptionalNote<T>;
  return { ...out, note };
}

function plainTextFromHtmlish(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Raw diagram pedagogy from authoring fields (before display normalization). */
export function diagramAuthoringInstructionsRawFromBlock(block: unknown): string | undefined {
  const b = blockRecord(block);
  for (const key of ["subtitle", "intro", "note"] as const) {
    const raw = typeof b[key] === "string" ? (b[key] as string).trim() : "";
    if (raw) return raw;
  }
  return undefined;
}

/** Persisted diagram instructions only — never fall back to legacy `content` (avoids overwriting editor field). */
export function diagramAuthoringInstructionsFromBlock(block: unknown): string | undefined {
  const raw = diagramAuthoringInstructionsRawFromBlock(block);
  if (!raw) return undefined;
  const normalized = normalizeDiagramPedagogyAuthoringForPersist(raw);
  return normalized || plainTextFromHtmlish(raw);
}

/** Student-facing diagram task (display-normalized; does not change stored data). */
export function diagramSubtitleFromBlock(block: unknown): string | undefined {
  return diagramInstructionsForDisplayFromBlock(block);
}

/** Raw student task from persisted studentTask field. */
export function diagramAuthoringStudentTaskFromBlock(block: unknown): string | undefined {
  const b = blockRecord(block);
  const raw = typeof b.studentTask === "string" ? b.studentTask.trim() : "";
  if (!raw) return undefined;
  const normalized = normalizeDiagramPedagogyAuthoringForPersist(raw);
  return normalized || plainTextFromHtmlish(raw);
}

/** Editor hydrate for dedicated student task field. */
export function diagramAuthoringStudentTaskForEditor(block: unknown): string | undefined {
  return diagramAuthoringStudentTaskFromBlock(block);
}

/**
 * Student/preview view: mirror editor hydrate so subtitle/studentTask/caption are on the block
 * object passed to LessonDiagramBlockDisplay (API may mirror instructions on intro/note/content).
 */
export function hydrateDiagramBlockForDisplay<T>(block: T): T {
  if (block == null || typeof block !== "object") return block;
  const row = block as Record<string, unknown>;
  if (String(row.type ?? "") !== "diagram") return block;
  const instructions = diagramAuthoringInstructionsForEditor(block);
  const studentTask = diagramAuthoringStudentTaskForEditor(block);
  const caption = typeof row.caption === "string" ? row.caption.trim() : "";
  return {
    ...row,
    ...(instructions ? { subtitle: instructions } : {}),
    ...(studentTask ? { studentTask } : {}),
    ...(caption ? { caption } : {}),
  } as T;
}

function attachDiagramInstructionsForPersist(
  out: Record<string, unknown>,
  instructions: string
): void {
  out.subtitle = instructions;
  // Dual-write: `intro` + `note` predate `subtitle` in the Mongoose schema.
  out.intro = instructions;
  out.note = instructions;
  // `content` always persisted historically — mirror instructions for student view round-trip.
  out.content = instructions;
}

/** Editor hydrate: persisted fields first; long `content` only (avoids short generator blurbs). */
export function diagramAuthoringInstructionsForEditor(block: unknown): string | undefined {
  const fromFields = diagramAuthoringInstructionsFromBlock(block);
  if (fromFields) return fromFields;

  const b = blockRecord(block);
  const content = typeof b.content === "string" ? b.content.trim() : "";
  if (!content || /^image\s+here$/i.test(content)) return undefined;
  const plain = plainTextFromHtmlish(content);
  return plain.length >= 80 ? plain : undefined;
}

/** Attach SS1 / generator block ordinal when present on authoring state. */
export function attachPersistedBlockNumber(
  out: Record<string, unknown>,
  block: unknown
): Record<string, unknown> {
  const n = blockRecord(block).number;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) {
    return { ...out, number: Math.trunc(n) };
  }
  return out;
}

/**
 * Normalized diagram block for API save (Create/Edit lesson).
 * Preserves imageUrl, caption, role, diagramVariant — required for generator visual imports.
 */
export function diagramBlockForPersist(block: unknown): Record<string, unknown> {
  const b = blockRecord(block);
  const imageUrl = typeof b.imageUrl === "string" ? b.imageUrl.trim() : "";
  const caption = typeof b.caption === "string" ? b.caption.trim() : "";
  const rawContent = typeof b.content === "string" ? b.content.trim() : "";
  const content = rawContent
    ? sanitizeTeacherMarkdown(rawContent)
    : "";
  const mode =
    b.mode === "annotated" || b.mode === "step" ? (b.mode as string) : "static";

  const out: Record<string, unknown> = {
    type: "diagram",
    content,
    mode,
    caption,
  };

  if (typeof b.title === "string" && b.title.trim()) out.title = b.title.trim();
  const instructions = diagramAuthoringInstructionsFromBlock(b);
  if (instructions) attachDiagramInstructionsForPersist(out, instructions);
  else if (content) out.content = content;
  const studentTask = diagramAuthoringStudentTaskFromBlock(b);
  if (studentTask) out.studentTask = studentTask;
  if (imageUrl) out.imageUrl = imageUrl;
  if (typeof b.imageSource === "string" && b.imageSource.trim()) {
    out.imageSource = b.imageSource.trim();
  }
  if (typeof b.alt === "string" && b.alt.trim()) out.alt = b.alt.trim();
  if (b.diagramVariant === "featured") out.diagramVariant = "featured";
  if (typeof b.role === "string" && b.role.trim()) out.role = b.role.trim();
  if (b.visualId != null && String(b.visualId).trim()) {
    out.visualId = String(b.visualId).trim();
  }

  const annotations = Array.isArray(b.annotations) ? b.annotations : [];
  if (annotations.length) out.annotations = annotations;
  const steps = Array.isArray(b.steps) ? b.steps : [];
  if (steps.length) out.steps = steps;
  const connectors = Array.isArray(b.connectors) ? b.connectors : [];
  if (connectors.length) out.connectors = connectors;

  return out;
}

type DiagramAuthoringPage = { pageId?: string; blocks?: unknown[] };

/**
 * After save+refetch, re-apply diagram instructions from the outgoing payload when the API
 * response omitted them (legacy DB rows / stale server builds).
 */
export function mergeSavedDiagramAuthoringInstructions(
  loadedPages: DiagramAuthoringPage[],
  savedPages: DiagramAuthoringPage[]
): DiagramAuthoringPage[] {
  if (!Array.isArray(loadedPages) || !Array.isArray(savedPages)) return loadedPages;

  const savedByPageId = new Map<string, DiagramAuthoringPage>();
  for (const page of savedPages) {
    const pid = page?.pageId != null ? String(page.pageId) : "";
    if (pid) savedByPageId.set(pid, page);
  }

  return loadedPages.map((page) => {
    const pid = page?.pageId != null ? String(page.pageId) : "";
    const savedPage = pid ? savedByPageId.get(pid) : undefined;
    if (!savedPage || !Array.isArray(page.blocks) || !Array.isArray(savedPage.blocks)) {
      return page;
    }

    const blocks = page.blocks.map((block, idx) => {
      const row = blockRecord(block);
      if (String(row.type ?? "") !== "diagram") return block;

      const savedRow = blockRecord(savedPage.blocks[idx]);
      if (String(savedRow.type ?? "") !== "diagram") return block;

      const instructions = diagramAuthoringInstructionsFromBlock(savedRow);
      const studentTask = diagramAuthoringStudentTaskFromBlock(savedRow);
      if (!instructions && !studentTask) return block;

      const loadedInstructions = diagramAuthoringInstructionsFromBlock(row);
      const loadedStudentTask = diagramAuthoringStudentTaskFromBlock(row);
      if (loadedInstructions === instructions && loadedStudentTask === studentTask) return block;

      return {
        ...row,
        ...(instructions
          ? {
              subtitle: instructions,
              intro: instructions,
              note: instructions,
              content: instructions,
            }
          : {}),
        ...(studentTask ? { studentTask } : {}),
      };
    });

    return { ...page, blocks };
  });
}

/** Graph block for save — structured fields only (never JSON in `content`; that caused raw JSON prose). */
export function graphBlockForLessonSave(block: unknown): Record<string, unknown> {
  const out = graphBlockForPersist(block);
  out.content = "";
  return attachPersistedBlockNumber(out, block);
}

/** Dev-only: log diagram/graph fields on outgoing lesson save. */
export function logLessonSaveBlocksDebug(
  payload: Record<string, unknown>,
  label = "CreateLesson save"
): void {
  if (process.env.NODE_ENV !== "development") return;
  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  const blocks = pages.flatMap((p) => {
    const pg = p as { blocks?: unknown[] };
    return Array.isArray(pg.blocks) ? pg.blocks : [];
  });
  const visual = blocks.map((b) => {
    const row = b as Record<string, unknown>;
    const t = String(row.type ?? "");
    if (t !== "diagram" && t !== "graph") return null;
    return {
      type: t,
      role: row.role ?? null,
      title: row.title ?? null,
      imageUrl: t === "diagram" ? row.imageUrl ?? null : undefined,
      caption: t === "diagram" ? row.caption ?? null : undefined,
      subtitle: t === "diagram" ? row.subtitle ?? null : undefined,
      studentTask: t === "diagram" ? row.studentTask ?? null : undefined,
      diagramVariant: t === "diagram" ? row.diagramVariant ?? null : undefined,
      graphSeriesLen: t === "graph" && Array.isArray(row.graphSeries) ? row.graphSeries.length : undefined,
      contentLen: typeof row.content === "string" ? row.content.length : 0,
    };
  }).filter(Boolean);
  if (visual.length) {
    console.log(`[${label}] visual/graph blocks`, visual);
  }
}
