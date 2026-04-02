/** Matches backend LESSON_PNG_DISPLAY_SIZE — one consistent frame for lesson raster images. */
export const LESSON_IMAGE_FRAME_PX = 600;

/** Selector for {@link LessonImageFrame} root (hide entire frame when image fails to load). */
export const LESSON_IMAGE_FRAME_SELECTOR = "[data-lesson-image-frame]";

/**
 * True when the URL is non-empty and safe to pass to &lt;img src&gt; for lesson rendering.
 * Prevents the fixed-size lesson frame from rendering as a blank portrait box.
 */
export function hasRenderableLessonImageSrc(raw?: string | null): boolean {
  if (raw == null || typeof raw !== "string") return false;
  const u = raw.trim();
  if (!u) return false;
  const lower = u.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return false;
  }
  return true;
}
