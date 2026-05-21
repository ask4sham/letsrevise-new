import type { InteractiveDiagramHotspot } from "../components/lesson/InteractiveDiagramBlock";
import { isInteractiveDiagramHotspotPlaced } from "./interactiveDiagramHotspots";

/** GCSE leaf cross-section — default % positions when teacher has not placed pins. */
const LABEL_POSITIONS: Array<{ match: RegExp; x: number; y: number }> = [
  { match: /\bstomata\b/i, x: 58, y: 76 },
  { match: /\bchloroplast\b/i, x: 38, y: 44 },
  { match: /\bxylem\b/i, x: 46, y: 22 },
  { match: /\bphloem\b/i, x: 54, y: 30 },
  { match: /\bmesophyll\b/i, x: 32, y: 52 },
  { match: /\bguard\s*cell/i, x: 64, y: 82 },
];

const FALLBACK_GRID = [
  { x: 28, y: 28 },
  { x: 62, y: 32 },
  { x: 34, y: 72 },
  { x: 66, y: 68 },
];

function lessonSuggestsPhotosynthesis(hint: string): boolean {
  const h = hint.toLowerCase();
  return (
    /\bphotosynth/.test(h) ||
    /\blimiting\s+factor/.test(h) ||
    (/\bbioenergetics\b/.test(h) && /\bphoto/.test(h))
  );
}

/**
 * Spread unplaced hotspots on photosynthesis / leaf diagrams so student view is usable without editor placement.
 */
export function applyPhotosynthesisHotspotDefaults(
  hotspots: InteractiveDiagramHotspot[],
  lessonHint = ""
): InteractiveDiagramHotspot[] {
  if (!hotspots.length) return hotspots;
  const needsLayout = hotspots.some((h) => !isInteractiveDiagramHotspotPlaced(h));
  if (!needsLayout) return hotspots;

  const labelHay = hotspots.map((h) => h.label).join(" ");
  if (!lessonSuggestsPhotosynthesis(lessonHint) && !/\b(stomata|chloroplast|xylem|phloem)\b/i.test(labelHay)) {
    return hotspots;
  }

  return hotspots.map((h, i) => {
    if (isInteractiveDiagramHotspotPlaced(h)) return h;
    const label = (h.label ?? "").trim();
    const found = LABEL_POSITIONS.find((p) => p.match.test(label));
    const pos = found ?? FALLBACK_GRID[i % FALLBACK_GRID.length];
    return { ...h, x: pos.x, y: pos.y };
  });
}
