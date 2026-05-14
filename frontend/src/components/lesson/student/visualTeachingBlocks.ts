import { hasRenderableLessonImageSrc } from "../../../constants/lessonImageDisplay";
import { isDragDropDiagramMode, readDragDropPairAnswerImageUrl } from "../../../utils/dragDropMatchDiagram";

function normType(type: unknown): string {
  return String(type ?? "").trim().toLowerCase();
}

/**
 * Value for `data-visual-block` on student wrappers. Uses display routing so mis-tagged
 * drag-drop rows still resolve when `routed === "dragDropMatch"`.
 */
export function getVisualTeachingDataAttribute(
  routedDisplayType: unknown,
  block?: unknown
): string | null {
  const r = String(routedDisplayType ?? "").trim();
  if (r === "diagram") return "diagram";
  if (r === "interactiveDiagram") return "interactive-diagram";
  if (r === "interactiveSequence") return "interactive-sequence";
  if (r === "dragDropMatch") {
    return isVisualTeachingBlock("dragDropMatch", block) ? "drag-drop-match" : null;
  }
  return null;
}

function dragDropMatchIsImageRich(block: Record<string, unknown>): boolean {
  const pairs = Array.isArray(block.pairs) ? block.pairs : [];
  for (const row of pairs) {
    const url = readDragDropPairAnswerImageUrl(row);
    if (url && hasRenderableLessonImageSrc(url)) return true;
  }
  return false;
}

/**
 * Foundation classifier: blocks that carry substantial on-screen visuals for teaching
 * (diagrams, sequences, hotspots, diagram-mode or image-rich drag-drop).
 *
 * Used for V12 chunk **layout mode** selection only — does not change block payloads or
 * inner component behaviour.
 */
export function isVisualTeachingBlock(type: unknown, block?: unknown): boolean {
  const t = normType(type);
  if (t === "diagram" || t === "interactivediagram" || t === "interactivesequence") {
    return true;
  }
  if (t !== "dragdropmatch") return false;

  const b = block != null && typeof block === "object" ? (block as Record<string, unknown>) : {};
  if (
    isDragDropDiagramMode(b.matchMode, {
      imageUrl: b.imageUrl,
      dropZones: b.dropZones,
    })
  ) {
    return true;
  }
  return dragDropMatchIsImageRich(b);
}
