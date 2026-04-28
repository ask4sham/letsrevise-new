/**
 * Interactive diagram hotspot helpers. Hotspots may omit x/y when unplaced (teacher will place on image).
 */

export function isInteractiveDiagramHotspotPlaced(h: { x?: unknown; y?: unknown } | null | undefined): boolean {
  const x = h?.x;
  const y = h?.y;
  return typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y);
}

/**
 * One hotspot for editor/lesson from API or local state.
 */
export function normalizeInteractiveDiagramHotspot(
  h: any,
  i: number
): { id: string; label: string; description: string; x?: number; y?: number } {
  if (!h || typeof h !== "object") {
    return { id: `h${i + 1}`, label: "", description: "" };
  }
  const id =
    typeof h.id === "string" && h.id.trim()
      ? h.id.trim().slice(0, 64)
      : `h${i + 1}`;
  const label = typeof h.label === "string" ? h.label.trim().slice(0, 200) : "";
  const description = typeof h.description === "string" ? h.description.trim().slice(0, 8000) : "";
  const x = h.x;
  const y = h.y;
  if (typeof x === "number" && Number.isFinite(x) && typeof y === "number" && Number.isFinite(y)) {
    return {
      id,
      label,
      description,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }
  return { id, label, description };
}
