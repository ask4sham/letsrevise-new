/**
 * Compact drag-drop answer card layout — diagram is primary; cards are lightweight labels.
 */

/** Max width for text-only draggable answer cards (px). */
export const DRAG_DROP_COMPACT_CARD_MAX_WIDTH_PX = 160;

/** Max width for image media draggable cards — compact Quizlet-style (px). */
export const DRAG_DROP_MEDIA_CARD_MAX_WIDTH_PX = 200;

/** @deprecated use DRAG_DROP_MEDIA_CARD_MAX_WIDTH_PX */
export const DRAG_DROP_PREVIEW_CARD_MAX_WIDTH_PX = DRAG_DROP_MEDIA_CARD_MAX_WIDTH_PX;

/** Compact thumbnail visual height in draggable bank cards (px). */
export const DRAG_DROP_THUMB_VISUAL_HEIGHT_PX = 110;

/** Max height for thumbnails placed on diagram drop-zones (px). */
export const DRAG_DROP_CHIP_THUMB_MAX_HEIGHT_PX = 88;

/** Max on-diagram dropped chip width (px). */
export const DRAG_DROP_CHIP_ZONE_MAX_WIDTH_PX = 220;

/** Min touch-friendly card height for text-only cards (px). */
export const DRAG_DROP_COMPACT_CARD_MIN_HEIGHT_PX = 56;

/** Media cards use auto height — keep constant for tests only. */
export const DRAG_DROP_PREVIEW_CARD_MIN_HEIGHT_PX = DRAG_DROP_COMPACT_CARD_MIN_HEIGHT_PX;

/** @deprecated use DRAG_DROP_MEDIA_CARD_MAX_WIDTH_PX */
export const DRAG_DROP_CARD_PREVIEW_WIDTH_PX = DRAG_DROP_MEDIA_CARD_MAX_WIDTH_PX;

/** @deprecated use DRAG_DROP_CHIP_THUMB_MAX_HEIGHT_PX */
export const DRAG_DROP_CHIP_THUMB_WIDTH_PX = DRAG_DROP_CHIP_THUMB_MAX_HEIGHT_PX;

/** Thumbnail max edge length on in-target / chip placements (px). */
export const DRAG_DROP_THUMB_MAX_PX = 72;

/** Default thumbnail height on compact inline placements (px). */
export const DRAG_DROP_THUMB_DEFAULT_PX = 56;

/** Max characters shown on draggable bank/target cards. */
export const DRAG_DROP_BANK_LABEL_MAX_CHARS = 48;

/** Max characters on on-diagram zone chips (marker + short label). */
export const DRAG_DROP_ZONE_CHIP_LABEL_MAX_CHARS = 20;

export function truncateDragDropCardLabel(text: string, maxChars = DRAG_DROP_BANK_LABEL_MAX_CHARS): string {
  const t = String(text ?? "").trim();
  if (!t) return "";
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}

/**
 * Max chip width so a placed card stays inside its drop zone on the diagram.
 * @param zoneXPercent 0–100
 * @param growRight when true, zone is on left half (chip grows right)
 */
export function computeDiagramZoneChipMaxWidthPx(
  zoneXPercent: number,
  growRight: boolean
): number {
  const zx = Math.min(100, Math.max(0, zoneXPercent));
  const sideBudget = growRight ? 100 - zx - 6 : zx - 6;
  const pxBudget = Math.max(96, Math.floor((sideBudget / 100) * 520));
  return Math.min(DRAG_DROP_CHIP_ZONE_MAX_WIDTH_PX, pxBudget);
}

/**
 * Scale factor when measured content is wider than the zone (never upscale).
 */
export function computeScaleToFit(contentWidth: number, containerWidth: number): number {
  if (!Number.isFinite(contentWidth) || !Number.isFinite(containerWidth) || containerWidth <= 0) {
    return 1;
  }
  if (contentWidth <= containerWidth) return 1;
  return Math.max(0.62, containerWidth / contentWidth);
}

export const DRAG_DROP_LAYOUT_VIEWPORTS = [1280, 1024, 768] as const;
