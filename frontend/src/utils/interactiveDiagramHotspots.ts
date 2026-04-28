/**
 * Interactive diagram hotspot helpers. Hotspots may omit x/y when unplaced (teacher will place on image).
 */

import type { HotspotMcqPayload } from "../api/ai";

/** Stored on a hotspot — “Test me” MCQ authored in templates or the editor payload. */
export type InteractiveDiagramEmbeddedTestMcq = {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation?: string;
};

/** Parse API/editor JSON into a validated embedded MCQ shape. */
export function parseEmbeddedInteractiveDiagramTest(raw: unknown): InteractiveDiagramEmbeddedTestMcq | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question.trim().slice(0, 2000) : "";
  const optionsRaw = Array.isArray(o.options) ? o.options.map((x) => String(x ?? "").trim()) : [];
  if (!question || optionsRaw.length !== 4 || optionsRaw.some((s) => !s)) return undefined;
  const tuple = optionsRaw as [string, string, string, string];
  let ci = typeof o.correctIndex === "number" && Number.isFinite(o.correctIndex) ? Math.round(Number(o.correctIndex)) : 0;
  if (!Number.isInteger(ci)) ci = 0;
  ci = Math.max(0, Math.min(3, ci));
  const explanation =
    typeof o.explanation === "string" && o.explanation.trim().length > 0
      ? String(o.explanation).trim().slice(0, 8000)
      : undefined;
  return {
    question,
    options: tuple,
    correctIndex: ci as 0 | 1 | 2 | 3,
    explanation,
  };
}

/** Map embedded test → same shape AI “Test me” uses (immediate display, no network). */
export function embeddedInteractiveDiagramTestToMcqPayload(
  test: InteractiveDiagramEmbeddedTestMcq
): HotspotMcqPayload | null {
  const tuple = test.options;
  if (!tuple || tuple.length !== 4) return null;
  const correctAnswer = tuple[test.correctIndex]?.trim();
  if (!correctAnswer) return null;
  const explanation =
    test.explanation?.trim() ||
    `Correct: ${correctAnswer}. Review the hotspot description above for more detail.`;
  return {
    question: test.question.trim(),
    options: tuple as [string, string, string, string],
    correctAnswer,
    explanation: explanation.slice(0, 8000),
  };
}

export function isInteractiveDiagramHotspotPlaced(h: { x?: unknown; y?: unknown } | null | undefined): boolean {
  const x = h?.x;
  const y = h?.y;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y);
}

export type NormalizedInteractiveDiagramHotspot = {
  id: string;
  label: string;
  description: string;
  x?: number;
  y?: number;
  test?: InteractiveDiagramEmbeddedTestMcq;
};

/**
 * One hotspot for editor/lesson from API or local state.
 */
export function normalizeInteractiveDiagramHotspot(h: any, i: number): NormalizedInteractiveDiagramHotspot {
  if (!h || typeof h !== "object") {
    return { id: `h${i + 1}`, label: "", description: "" };
  }
  const id =
    typeof h.id === "string" && h.id.trim()
      ? h.id.trim().slice(0, 64)
      : `h${i + 1}`;
  const label = typeof h.label === "string" ? h.label.trim().slice(0, 200) : "";
  const description = typeof h.description === "string" ? h.description.trim().slice(0, 8000) : "";
  const test = parseEmbeddedInteractiveDiagramTest(h.test);
  const x = h.x;
  const y = h.y;
  if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
    return {
      id,
      label,
      description,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      ...(test ? { test } : {}),
    };
  }
  return { id, label, description, ...(test ? { test } : {}) };
}
