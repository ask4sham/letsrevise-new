import { hasRenderableLessonImageSrc, LESSON_IMAGE_FRAME_SELECTOR } from "../../constants/lessonImageDisplay";

export type LessonLightboxItem = {
  src: string;
  /** From inline &lt;img alt&gt; when available */
  alt?: string;
};

/**
 * True when the element is likely visible on screen (not `display:none`, zero size, or `hidden`).
 * Used so the lightbox gallery only includes real lesson frames, not broken/hidden placeholders.
 */
export function isLessonLightboxFrameVisible(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const opacity = parseFloat(style.opacity || "1");
  if (Number.isFinite(opacity) && opacity === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
}

/**
 * Collect lesson lightbox items in document order from frames that opt in with `data-lesson-lightbox-src`.
 * Only visible frames are included (excludes broken-image-hidden cards, off-DOM placeholders, etc.).
 */
export function collectVisibleLessonLightboxItems(): LessonLightboxItem[] {
  const nodes = document.querySelectorAll<HTMLElement>(
    `${LESSON_IMAGE_FRAME_SELECTOR}[data-lesson-lightbox-src]`
  );
  const items: LessonLightboxItem[] = [];
  nodes.forEach((el) => {
    if (!isLessonLightboxFrameVisible(el)) return;
    const src = el.getAttribute("data-lesson-lightbox-src");
    if (!hasRenderableLessonImageSrc(src)) return;
    const img = el.querySelector("img");
    const altRaw = img?.getAttribute("alt");
    const alt = altRaw && altRaw.trim() ? altRaw.trim() : undefined;
    items.push({ src: src!.trim(), alt });
  });
  return items;
}

/**
 * Resolve gallery index for the clicked src. If the same URL appears more than once, matches the first visible instance.
 */
export function indexOfLightboxSrc(items: LessonLightboxItem[], clickedSrc: string): number {
  const t = clickedSrc.trim();
  return items.findIndex((i) => i.src === t);
}
