/**
 * Diagram variant for `dragDropMatch` blocks — optional matchMode/dropZones;
 * omit matchMode ⇒ classic text-column layout (backwards compatible).
 */

export type DragDropMatchPersistedMode = "text" | "diagram";

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
  if (raw === "diagram") return "diagram";
  if (raw === "text") return "text";
  return undefined;
}

/** Explicit diagram mode only — never inferred from stray fields (avoids accidental layout change). */
export function isDragDropDiagramMode(matchMode: unknown): boolean {
  return parseDragDropMatchMode(matchMode) === "diagram";
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
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
  let x: number | undefined;
  let y: number | undefined;
  if (typeof o.x === "number" && Number.isFinite(o.x)) x = clampPct(o.x);
  if (typeof o.y === "number" && Number.isFinite(o.y)) y = clampPct(o.y);
  if (requireCoords && (typeof x !== "number" || typeof y !== "number")) return null;
  const explanation =
    typeof o.explanation === "string" && o.explanation.trim()
      ? o.explanation.trim().slice(0, 8000)
      : undefined;
  const out: NormalizedDragDropDiagramZone = {
    id,
    correctPairId,
    ...(typeof x === "number" && Number.isFinite(x) ? { x } : {}),
    ...(typeof y === "number" && Number.isFinite(y) ? { y } : {}),
    ...(explanation ? { explanation } : {}),
  };
  return out;
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
  return out;
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
  return out;
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
