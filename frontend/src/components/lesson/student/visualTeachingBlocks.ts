function normType(type: unknown): string {
  return String(type ?? "").trim().toLowerCase();
}

/**
 * Value for `data-visual-block` on student wrappers. Uses display routing so mis-tagged
 * drag-drop rows still resolve when `routed === "dragDropMatch"`.
 */
export function getVisualTeachingDataAttribute(
  routedDisplayType: unknown,
  _block?: unknown
): string | null {
  const r = String(routedDisplayType ?? "").trim();
  if (r === "diagram") return "diagram";
  if (r === "interactiveDiagram") return "interactive-diagram";
  if (r === "interactiveSequence") return "interactive-sequence";
  if (r === "dragDropMatch") {
    return "drag-drop-match";
  }
  if (r === "graph") return "graph";
  return null;
}

/**
 * Foundation classifier: blocks that carry substantial on-screen visuals for teaching
 * (diagrams, sequences, hotspots, drag-drop).
 *
 * Used for V12 chunk layout mode selection only — does not change block payloads or
 * inner component behaviour.
 */
function blockHasGraphPayload(block: unknown): boolean {
  if (block == null || typeof block !== "object") return false;
  const b = block as Record<string, unknown>;
  const gt = String(b.graphType ?? "").trim().toLowerCase();
  if (gt === "line" || gt === "bar" || gt === "scatter") return true;
  const seriesRaw = b.graphSeries ?? b.series;
  return (
    Array.isArray(seriesRaw) &&
    seriesRaw.some((row) => {
      if (!row || typeof row !== "object") return false;
      const pts = (row as { points?: unknown }).points;
      return Array.isArray(pts) && pts.length > 0;
    })
  );
}

export function isVisualTeachingBlock(type: unknown, block?: unknown): boolean {
  const t = normType(type);
  if (t === "diagram" || t === "interactivediagram" || t === "interactivesequence" || t === "graph") {
    return true;
  }
  if (t === "text" && blockHasGraphPayload(block)) return true;
  if (t !== "dragdropmatch") return false;

  /* Text and diagram drag-drop both need full teaching width in V12 layout. */
  return true;
}
