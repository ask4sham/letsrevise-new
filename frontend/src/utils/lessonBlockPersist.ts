import { graphBlockForPersist } from "../components/lesson/graphBlockTypes";
import { sanitizeTeacherMarkdown } from "./lessonTeacherMarkdown";

function blockRecord(block: unknown): Record<string, unknown> {
  return block != null && typeof block === "object" ? (block as Record<string, unknown>) : {};
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
    : imageUrl
      ? "image here"
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
      diagramVariant: t === "diagram" ? row.diagramVariant ?? null : undefined,
      graphSeriesLen: t === "graph" && Array.isArray(row.graphSeries) ? row.graphSeries.length : undefined,
      contentLen: typeof row.content === "string" ? row.content.length : 0,
    };
  }).filter(Boolean);
  if (visual.length) {
    console.log(`[${label}] visual/graph blocks`, visual);
  }
}
