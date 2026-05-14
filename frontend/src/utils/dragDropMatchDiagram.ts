/**
 * Diagram variant for `dragDropMatch` blocks — optional matchMode/dropZones;
 * omit matchMode ⇒ classic text-column layout (backwards compatible).
 */

export type DragDropMatchPersistedMode = "text" | "diagram";
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

export function parseDragDropMatchMode(raw: unknown): DragDropMatchPersistedMode | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim().toLowerCase();
  if (s === "diagram") return "diagram";
  if (s === "text") return "text";
  return undefined;
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
  if (direct === "diagram") return "diagram";
  if (ctx && hasDiagramInferenceSignals(ctx)) return "diagram";
  return undefined;
}

/** Authoring UI: coerce unknown persisted values to a stable radio value for selects and panels. */
export function resolveDragDropMatchModeForUi(
  raw: unknown,
  ctx?: DragDropMatchModePersistContext
): "text" | "diagram" {
  return resolveDragDropMatchModeForPersist(raw, ctx) === "diagram" ? "diagram" : "text";
}

export function isDragDropDiagramMode(
  matchMode: unknown,
  ctx?: DragDropMatchModePersistContext
): boolean {
  return resolveDragDropMatchModeForPersist(matchMode, ctx) === "diagram";
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
