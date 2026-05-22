/**
 * Diagram variant for `dragDropMatch` blocks — optional matchMode/dropZones;
 * omit matchMode ⇒ classic text-column layout (backwards compatible).
 */

import { resolveLessonDisplayBlockType } from "../types/lessonBlocks";

export type DragDropMatchPersistedMode = "text" | "diagram" | "text-to-image";
/** Values written to Mongo / API (`textToImage` avoids hyphen enum issues). */
export type DragDropMatchStoredMatchMode = "text" | "diagram" | "textToImage";
/** Authoring select values — `standard` persists as `text` for backward compatibility. */
export type DragDropMatchUiMode = "standard" | "diagram" | "text-to-image";
/** Block slice may hold stored or legacy matchMode tokens. */
export type DragDropMatchAuthoringMatchMode = DragDropMatchPersistedMode | DragDropMatchStoredMatchMode;
export type DragDropDiagramImageFit = "contain" | "cover";
export type DragDropDiagramImagePosition =
  | "center center"
  | "center top"
  | "center bottom";

export type DragDropMatchDropZoneInput = {
  id: string;
  x?: number;
  y?: number;
  correctPairId: string;
  explanation?: string;
};

/** Drop zone safe for authoring or student overlay (x/y omitted until teacher places). */
export type NormalizedDragDropDiagramZone = DragDropMatchDropZoneInput;

/** Zone with coordinates — used when rendering targets on the diagram. */
export type PlacedDragDropDiagramZone = {
  id: string;
  x: number;
  y: number;
  correctPairId: string;
  explanation?: string;
};

/** Normalizes generator/API aliases for text-to-image layout. */
function isTextToImageModeToken(s: string): boolean {
  const t = s.replace(/[\s_]+/g, "-");
  return t === "text-to-image" || t === "texttoimage" || t === "text-image";
}

/** Durable layout field (no enum) — same role as diagram `imageUrl` + `dropZones`. */
export function readDragDropLayoutFromBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return undefined;
  const o = block as Record<string, unknown>;
  return o.dragDropLayout ?? o.drag_drop_layout;
}

/** Read persisted layout mode from block (tolerate snake_case API aliases). */
export function readDragDropMatchModeFromBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return undefined;
  const o = block as Record<string, unknown>;
  const layout = readDragDropLayoutFromBlock(block);
  if (layout != null && String(layout).trim()) return layout;
  return o.matchMode ?? o.match_mode ?? o.matchmode;
}

/** Values written to Mongo — `textToImage` avoids hyphen enum edge cases; keep parsing both. */
export function dragDropLayoutPersistedValues(
  mode: DragDropMatchPersistedMode
): { matchMode: string; dragDropLayout: string } {
  if (mode === "diagram") return { matchMode: "diagram", dragDropLayout: "diagram" };
  if (mode === "text-to-image") return { matchMode: "textToImage", dragDropLayout: "textToImage" };
  return { matchMode: "text", dragDropLayout: "standard" };
}

function applyPersistedDragDropLayoutFields(
  ddmOut: Record<string, unknown>,
  mode: DragDropMatchPersistedMode
): void {
  const stored = dragDropLayoutPersistedValues(mode);
  ddmOut.matchMode = stored.matchMode;
  ddmOut.dragDropLayout = stored.dragDropLayout;
}

export function parseDragDropMatchMode(raw: unknown): DragDropMatchPersistedMode | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (s === "diagram") return "diagram";
  if (s === "text" || s === "standard") return "text";
  if (isTextToImageModeToken(s)) return "text-to-image";
  return undefined;
}

/** Map authoring layout select value → persisted `matchMode`. */
export function dragDropMatchModeFromUiSelect(value: string): DragDropMatchPersistedMode | undefined {
  const v = String(value ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (v === "diagram") return "diagram";
  if (v === "text-to-image" || v === "texttoimage") return "text-to-image";
  if (v === "standard" || v === "text") return "text";
  return undefined;
}

/** Pass through persisted matchMode when rendering student/preview blocks. */
export function dragDropMatchModeForBlockProps(
  raw: unknown
): DragDropMatchPersistedMode | undefined {
  return parseDragDropMatchMode(raw);
}

/** Text-to-image target field only (not answer-card thumbnails). */
export function readDragDropPairExplicitTargetImageUrl(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const o = row as Record<string, unknown>;
  const v = o.imageUrl ?? o.image_url;
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

/**
 * Resolve layout for save, hydrate, and preview — prefers `dragDropLayout` / `matchMode`, then pair
 * `imageUrl` targets, then diagram inference. Never treats `answerImageUrl` alone as text-to-image.
 */
export function resolveDragDropPersistMode(block: unknown): DragDropMatchPersistedMode | undefined {
  const b = block != null && typeof block === "object" ? (block as Record<string, unknown>) : {};
  const raw = readDragDropMatchModeFromBlock(b);
  const direct = parseDragDropMatchMode(raw);
  if (direct === "text") return "text";
  if (direct === "text-to-image") return "text-to-image";
  if (direct === "diagram") return "diagram";
  const pairs = Array.isArray(b.pairs) ? b.pairs : [];
  if (pairs.some((row) => readDragDropPairExplicitTargetImageUrl(row))) {
    return "text-to-image";
  }
  if (hasDiagramInferenceSignals({ imageUrl: b.imageUrl, dropZones: b.dropZones })) {
    return "diagram";
  }
  return undefined;
}

/** Resolve layout for student/preview — reads `dragDropLayout` when `matchMode` is omitted. */
export function dragDropMatchModeFromBlockForProps(
  block: unknown
): DragDropMatchPersistedMode | undefined {
  return resolveDragDropPersistMode(block);
}

export function parseDragDropDiagramImageFit(raw: unknown): DragDropDiagramImageFit | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (s === "contain") return "contain";
  if (s === "cover") return "cover";
  return undefined;
}

export function parseDragDropDiagramImagePosition(
  raw: unknown
): DragDropDiagramImagePosition | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, " ");
  if (s === "center center" || s === "center top" || s === "center bottom") {
    return s;
  }
  if (s === "center") return "center center";
  if (s === "top") return "center top";
  if (s === "bottom") return "center bottom";
  return undefined;
}

/** Context for inferring diagram mode when `matchMode` was omitted (e.g. legacy saves). */
export type DragDropMatchModePersistContext = {
  imageUrl?: unknown;
  dropZones?: unknown;
};

function hasDiagramInferenceSignals(ctx: DragDropMatchModePersistContext): boolean {
  const img = typeof ctx.imageUrl === "string" && ctx.imageUrl.trim().length > 0;
  const dz = Array.isArray(ctx.dropZones) ? ctx.dropZones : [];
  const hasZone =
    dz.length > 0 &&
    dz.some((z) => {
      if (!z || typeof z !== "object") return false;
      const o = z as Record<string, unknown>;
      return String(o.correctPairId ?? "").trim().length > 0;
    });
  return img && hasZone;
}

/**
 * Resolved mode for save/load: explicit `text` / `diagram` wins; otherwise infer `diagram` only when
 * there is a non-empty image URL and at least one drop zone with a `correctPairId`.
 */
export function resolveDragDropMatchModeForPersist(
  rawMode: unknown,
  ctx?: DragDropMatchModePersistContext
): DragDropMatchPersistedMode | undefined {
  const direct = parseDragDropMatchMode(rawMode);
  if (direct === "text") return "text";
  if (direct === "text-to-image") return "text-to-image";
  if (direct === "diagram") return "diagram";
  if (ctx && hasDiagramInferenceSignals(ctx)) return "diagram";
  return undefined;
}

/** Authoring UI: coerce unknown persisted values to a stable select value. */
export function resolveDragDropMatchModeForUi(
  raw: unknown,
  ctx?: DragDropMatchModePersistContext
): DragDropMatchUiMode {
  const direct = parseDragDropMatchMode(raw);
  if (direct === "diagram") return "diagram";
  if (direct === "text-to-image") return "text-to-image";
  if (direct === "text") return "standard";
  if (ctx && hasDiagramInferenceSignals(ctx)) return "diagram";
  return "standard";
}

export function isDragDropDiagramMode(
  matchMode: unknown,
  ctx?: DragDropMatchModePersistContext
): boolean {
  return resolveDragDropMatchModeForPersist(matchMode, ctx) === "diagram";
}

export function isDragDropTextToImageMode(matchMode: unknown): boolean {
  return parseDragDropMatchMode(matchMode) === "text-to-image";
}

/** True when at least one pair has a renderable target image (text-to-image student layout). */
export function dragDropPairsHaveTargetImages(
  pairs: ReadonlyArray<unknown>,
  hasRenderable?: (url: string) => boolean
): boolean {
  const ok = hasRenderable ?? ((url: string) => Boolean(String(url ?? "").trim()));
  if (!Array.isArray(pairs)) return false;
  return pairs.some((row) => {
    const img = readDragDropPairTargetImageUrl(row);
    return Boolean(img && ok(img));
  });
}

export function dragDropPairEditorLabels(mode: DragDropMatchUiMode): {
  prompt: string;
  answer: string;
  image: string;
} {
  if (mode === "text-to-image") {
    return {
      prompt: "Draggable text",
      answer: "Target label (shown after Check)",
      image: "Target image URL",
    };
  }
  return {
    prompt: "Prompt",
    answer: "Answer",
    image: "Answer image (optional)",
  };
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Hydrate diagram zone % from API/DB (Mongo often returns numbers; some paths stringify x/y).
 * Must match backend tolerance in `lessons.js` dragDropMatch sanitisation.
 */
export function coerceDiagramZonePct(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) return clampPct(raw);
  const n = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isFinite(n)) return undefined;
  return clampPct(n);
}

/**
 * Validates one raw zone row. Returns normalized row or null when unusable on the diagram.
 * For student view pass onlyZonesWithCoords=true to require x/y.
 */
export function normalizeDragDropDiagramZoneRaw(
  h: unknown,
  index: number,
  validPairIds: ReadonlySet<string>,
  opts?: { requireCoords?: boolean }
): NormalizedDragDropDiagramZone | null {
  const requireCoords = opts?.requireCoords ?? false;
  if (!h || typeof h !== "object") return null;
  const o = h as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 64) : `dz_${index + 1}`;
  const correctPairId =
    typeof o.correctPairId === "string" && o.correctPairId.trim() ? o.correctPairId.trim().slice(0, 80) : "";
  if (!correctPairId || !validPairIds.has(correctPairId)) return null;
  const x = coerceDiagramZonePct(o.x);
  const y = coerceDiagramZonePct(o.y);
  if (requireCoords && (x === undefined || y === undefined)) return null;
  const explanation =
    typeof o.explanation === "string" && o.explanation.trim()
      ? o.explanation.trim().slice(0, 8000)
      : undefined;
  const out: NormalizedDragDropDiagramZone = {
    id,
    correctPairId,
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(explanation ? { explanation } : {}),
  };
  return out;
}

/**
 * Ensures each zone has a unique `id`. Duplicate ids (same string reused for multiple zones)
 * break React reconciliation and `placements[zone.id]` — multiple markers share one slot.
 */
export function dedupeDiagramZoneIds<T extends { id: string }>(zones: readonly T[]): T[] {
  const seen = new Set<string>();
  return zones.map((z) => {
    let id = z.id;
    let n = 0;
    while (seen.has(id)) {
      n += 1;
      id = `${z.id}__dup${n}`;
    }
    seen.add(id);
    return id === z.id ? z : ({ ...z, id } as T);
  });
}

/** Student/diagram overlay: zones with correct pair refs and finite x/y %. */
export function sanitizePlacedDiagramDropZones(
  rawZones: unknown,
  pairIds: ReadonlyArray<string>
): PlacedDragDropDiagramZone[] {
  const valid = new Set(pairIds.filter((id) => id && String(id).trim()));
  const arr = Array.isArray(rawZones) ? rawZones : [];
  const out: PlacedDragDropDiagramZone[] = [];
  for (let i = 0; i < arr.length; i++) {
    const z = normalizeDragDropDiagramZoneRaw(arr[i], i, valid, { requireCoords: true });
    if (
      z &&
      typeof z.x === "number" &&
      typeof z.y === "number" &&
      Number.isFinite(z.x) &&
      Number.isFinite(z.y)
    ) {
      out.push({
        id: z.id,
        x: z.x,
        y: z.y,
        correctPairId: z.correctPairId,
        ...(z.explanation ? { explanation: z.explanation } : {}),
      });
    }
  }
  return dedupeDiagramZoneIds(out);
}

/** Editor payloads: keep zones with valid pair id; coords optional. */
export function sanitizeDiagramDropZonesForAuthoring(rawZones: unknown, pairIds: ReadonlyArray<string>): NormalizedDragDropDiagramZone[] {
  const valid = new Set(pairIds.filter((id) => id && String(id).trim()));
  const arr = Array.isArray(rawZones) ? rawZones : [];
  const out: NormalizedDragDropDiagramZone[] = [];
  for (let i = 0; i < arr.length; i++) {
    const z = normalizeDragDropDiagramZoneRaw(arr[i], i, valid, { requireCoords: false });
    if (z) out.push(z);
  }
  return dedupeDiagramZoneIds(out);
}

export type RepairDiagramDropZonesOptions = {
  /**
   * When true, zone at index i gets `correctPairId = pairIds[i]` (clamped), matching
   * “A → 1st pair, B → 2nd pair, …”. Use when answer rows are ordered to match zone letters.
   * When false, each zone keeps a stored `correctPairId` if it is still a valid pair id; otherwise
   * the first pair id (same fallback as the authoring dropdown for orphan refs).
   */
  alignZoneIndexToPairIndex?: boolean;
};

/**
 * One-click editor repair: new unique zone ids, same array order, preserved x/y and explanation.
 * Then runs `sanitizeDiagramDropZonesForAuthoring` (valid pair refs + id dedupe).
 */
export function repairDiagramDropZonesForLessonEditor(
  rawZones: unknown,
  pairs: ReadonlyArray<{ id?: string }>,
  newZoneId: () => string,
  opts?: RepairDiagramDropZonesOptions
): NormalizedDragDropDiagramZone[] {
  const pairIds = pairs.map((p) => String(p?.id ?? "").trim()).filter(Boolean);
  if (pairIds.length === 0) return [];

  const valid = new Set(pairIds);
  const fallbackFirst = pairIds[0] ?? "";
  const align = Boolean(opts?.alignZoneIndexToPairIndex);
  const arr = Array.isArray(rawZones) ? rawZones : [];
  const rawLike: unknown[] = [];

  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    if (!row || typeof row !== "object") continue;
    const z = row as Record<string, unknown>;

    let correctPairId: string;
    if (align) {
      correctPairId = pairIds[Math.min(i, pairIds.length - 1)] ?? fallbackFirst;
    } else {
      const storedCp = typeof z.correctPairId === "string" ? z.correctPairId.trim() : "";
      correctPairId = storedCp && valid.has(storedCp) ? storedCp : fallbackFirst;
    }

    const built: Record<string, unknown> = {
      id: newZoneId(),
      correctPairId,
    };
    const x = coerceDiagramZonePct(z.x);
    const y = coerceDiagramZonePct(z.y);
    if (x !== undefined) built.x = x;
    if (y !== undefined) built.y = y;
    const expl =
      typeof z.explanation === "string" && z.explanation.trim()
        ? z.explanation.trim().slice(0, 8000)
        : undefined;
    if (expl) built.explanation = expl;
    rawLike.push(built);
  }

  return sanitizeDiagramDropZonesForAuthoring(rawLike, pairIds);
}

export function mergeDiagramZoneExplanation(
  zoneExplanation: string | undefined,
  pairExplanation: string | undefined
): string | undefined {
  const ze = zoneExplanation?.trim();
  const pe = pairExplanation?.trim();
  if (ze) return ze;
  if (pe) return pe;
  return undefined;
}

/**
 * Optional answer-card image on drag/drop pairs — tolerate camelCase, snake_case, or stray `answerImageURL`.
 */
export function readDragDropPairAnswerImageUrl(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const o = row as Record<string, unknown>;
  const v = o.answerImageUrl ?? o.answer_image_url ?? o.answerImageURL;
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

/** Large image target for text-to-image mode — `imageUrl` preferred, `answerImageUrl` as fallback. */
export function readDragDropPairTargetImageUrl(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const o = row as Record<string, unknown>;
  const v = o.imageUrl ?? o.image_url ?? o.answerImageUrl ?? o.answer_image_url ?? o.answerImageURL;
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export type NormalizedDragDropPairRow = {
  id: string;
  prompt: string;
  answer: string;
  explanation?: string;
  answerImageUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
};

/** Shared pair shape for save/load/import (text, diagram bank, text-to-image targets). */
export function normalizeDragDropPairRow(
  row: unknown,
  index: number,
  fallbackId: string
): NormalizedDragDropPairRow | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : fallbackId || `pair_${index + 1}`;
  const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  const answer = typeof o.answer === "string" ? o.answer.trim() : "";
  const explanation =
    typeof o.explanation === "string" && o.explanation.trim() ? o.explanation.trim() : undefined;
  const thumb = readDragDropPairAnswerImageUrl(row);
  const explicitTarget =
    typeof o.imageUrl === "string" && o.imageUrl.trim()
      ? o.imageUrl.trim()
      : typeof o.image_url === "string" && o.image_url.trim()
        ? o.image_url.trim()
        : undefined;
  const targetImg = explicitTarget || readDragDropPairTargetImageUrl(row);
  const imageAlt = readDragDropPairImageAlt(row);
  const out: NormalizedDragDropPairRow = { id, prompt, answer };
  if (explanation) out.explanation = explanation;
  if (thumb) out.answerImageUrl = thumb;
  if (targetImg) out.imageUrl = targetImg;
  if (imageAlt) out.imageAlt = imageAlt;
  return out;
}

export function readDragDropPairImageAlt(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const o = row as Record<string, unknown>;
  const v = o.imageAlt ?? o.image_alt ?? o.alt;
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

/** Map persisted pair row → DragDropMatchBlock `pairs` entry (thumbnails + text-to-image targets). */
export type BuildDragDropMatchBlockForPersistOptions = {
  newId: () => string;
  logZoneBindings?: (
    tag: string,
    dropZones: unknown,
    pairs: ReadonlyArray<{ id: string; answer?: string }>
  ) => void;
};

/** Normalized dragDropMatch block for lesson PUT payloads (Edit + Create). */
export function buildDragDropMatchBlockForPersist(
  block: unknown,
  opts: BuildDragDropMatchBlockForPersistOptions
): Record<string, unknown> | null {
  if (resolveLessonDisplayBlockType(block) !== "dragDropMatch") return null;
  const b = block as Record<string, unknown>;
  const rawPairs = Array.isArray(b.pairs) ? b.pairs : [];
  const pairs = rawPairs
    .slice(0, 20)
    .map((row, ri) => normalizeDragDropPairRow(row, ri, opts.newId()))
    .filter((row): row is NormalizedDragDropPairRow => Boolean(row && String(row.id).trim()));
  const zonePairIds = pairs.map((row) => row.id);
  const rawZonesPersist = Array.isArray(b.dropZones) ? b.dropZones : [];
  const dropZonesPersist = sanitizeDiagramDropZonesForAuthoring(rawZonesPersist, zonePairIds).slice(0, 40);
  const resolvedPersist = resolveDragDropPersistMode(b);
  const ddmOut: Record<string, unknown> = {
    type: "dragDropMatch",
    title: typeof b.title === "string" ? b.title.trim() : "",
    intro: b.intro != null ? String(b.intro).trim() : "",
    instructions: b.instructions != null ? String(b.instructions).trim() : "",
    pairs,
  };
  if (resolvedPersist === "diagram") {
    applyPersistedDragDropLayoutFields(ddmOut, "diagram");
    const imgP = typeof b.imageUrl === "string" ? b.imageUrl.trim() : "";
    if (imgP) ddmOut.imageUrl = imgP;
    ddmOut.dropZones = dropZonesPersist;
    opts.logZoneBindings?.("persist payload (diagram)", dropZonesPersist, pairs);
  } else if (resolvedPersist === "text") {
    applyPersistedDragDropLayoutFields(ddmOut, "text");
    delete ddmOut.imageUrl;
    delete ddmOut.dropZones;
  } else if (resolvedPersist === "text-to-image") {
    applyPersistedDragDropLayoutFields(ddmOut, "text-to-image");
    delete ddmOut.imageUrl;
    delete ddmOut.dropZones;
  }
  if (typeof b.role === "string" && b.role.trim()) ddmOut.role = b.role.trim();
  return ddmOut;
}

export function mapDragDropPairForBlockRender(
  row: unknown,
  index: number
): {
  id: string;
  prompt: string;
  answer: string;
  explanation?: string;
  answerImageUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
} {
  const o = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const id = String(o.id ?? "").trim() || `p${index}`;
  const thumb = readDragDropPairAnswerImageUrl(row);
  const explicitTarget =
    typeof o.imageUrl === "string" && o.imageUrl.trim()
      ? o.imageUrl.trim()
      : typeof o.image_url === "string" && o.image_url.trim()
        ? o.image_url.trim()
        : undefined;
  const target = explicitTarget || readDragDropPairTargetImageUrl(row);
  const alt = readDragDropPairImageAlt(row);
  return {
    id,
    prompt: String(o.prompt ?? ""),
    answer: String(o.answer ?? ""),
    explanation: o.explanation != null ? String(o.explanation) : undefined,
    ...(thumb ? { answerImageUrl: thumb } : {}),
    ...(target ? { imageUrl: target } : {}),
    ...(alt ? { imageAlt: alt } : {}),
  };
}

/** Debug aid (browser): `localStorage.DEBUG_DDM = "1"` — logs zone ↔ pair bindings. Safe no-op on server / without flag. */
export function logDragDropMatchZoneBindings(
  tag: string,
  dropZones: unknown,
  pairs: ReadonlyArray<{ id: string; answer?: string }>
): void {
  if (typeof window === "undefined" || window.localStorage?.getItem("DEBUG_DDM") !== "1") return;
  const dz = Array.isArray(dropZones) ? dropZones : [];
  console.log(`[dragDropMatch diagram] ${tag}`);
  console.table(
    dz.map((z: unknown) => {
      const o = z && typeof z === "object" ? (z as Record<string, unknown>) : {};
      const zid = o.id != null ? String(o.id) : "";
      const cp = typeof o.correctPairId === "string" ? o.correctPairId : String(o.correctPairId ?? "");
      const pc = pairs.find((p) => String(p.id) === String(cp).trim());
      return {
        id: zid,
        correctPairId: String(cp).trim(),
        correctAnswerText: pc?.answer,
      };
    })
  );
}
