import React, { useCallback } from "react";
import { hasRenderableLessonImageSrc, LESSON_IMAGE_FRAME_SELECTOR } from "../../constants/lessonImageDisplay";
import { resolveFullResolutionImageUrlForLightbox } from "../../utils/assetUrl";
import { useLessonImageLightbox } from "./LessonImageLightbox";
import "./lessonImageCard.css";

type LessonImageFrameProps = {
  children: React.ReactNode;
  /** Extra classes (e.g. tests) */
  className?: string;
  /**
   * Visual hierarchy: primary = key diagrams / hero; secondary = supporting inline images;
   * default = balanced lesson visuals.
   */
  variant?: "default" | "primary" | "secondary";
  /**
   * Display URL (typically matches child &lt;img&gt; src). Used to decide if the card can open the lightbox.
   * The modal loads {@link resolveFullResolutionImageUrlForLightbox}(lightboxSrc) so PNGs use full-res, not `*.display.png`.
   */
  lightboxSrc?: string | null;
};

/** Hide broken/empty images and the surrounding card (avoids blank boxes). */
export function hideBrokenLessonImage(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.style.display = "none";
  const frame = img.closest(LESSON_IMAGE_FRAME_SELECTOR);
  if (frame instanceof HTMLElement) frame.style.display = "none";
  const diagramShell = img.closest("[data-lesson-diagram-frame]");
  if (diagramShell instanceof HTMLElement) diagramShell.style.display = "none";
  const uploadedDiagram = img.closest(".lesson-uploaded-diagram");
  if (uploadedDiagram instanceof HTMLElement) uploadedDiagram.style.display = "none";
  const fig = img.closest("figure");
  if (fig instanceof HTMLElement) fig.style.display = "none";
}

/**
 * Lesson image card: clear container, spacing, light elevation. Uses global `.lesson-image-card` styles.
 */
export function LessonImageFrame({
  children,
  className,
  variant = "default",
  lightboxSrc,
}: LessonImageFrameProps) {
  const lightbox = useLessonImageLightbox();
  const mod =
    variant === "primary"
      ? "lesson-image-card--primary"
      : variant === "secondary"
        ? "lesson-image-card--secondary"
        : "";

  const displaySrc = (lightboxSrc ?? "").trim();
  const openInLightboxSrc = displaySrc
    ? resolveFullResolutionImageUrlForLightbox(displaySrc)
    : "";

  const canLightbox = Boolean(
    lightbox && displaySrc && hasRenderableLessonImageSrc(displaySrc)
  );

  const onActivate = useCallback(() => {
    if (canLightbox && openInLightboxSrc) lightbox!.open(openInLightboxSrc);
  }, [canLightbox, lightbox, openInLightboxSrc]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!canLightbox) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
    [canLightbox, onActivate]
  );

  return (
    <div
      data-lesson-image-frame=""
      data-lesson-lightbox-src={canLightbox && openInLightboxSrc ? openInLightboxSrc : undefined}
      className={["lesson-image-card", mod, canLightbox ? "clickable" : "", className].filter(Boolean).join(" ")}
      onClick={canLightbox ? onActivate : undefined}
      onKeyDown={canLightbox ? onKeyDown : undefined}
      role={canLightbox ? "button" : undefined}
      tabIndex={canLightbox ? 0 : undefined}
      aria-label={canLightbox ? "View larger image" : undefined}
    >
      {canLightbox ? (
        <span className="lesson-image-card-zoom-hint" aria-hidden>
          🔍
        </span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * For images outside the card (e.g. diagram overlay host) — prefer `.lesson-image-card img` when inside a card.
 */
export const lessonImageFrameImgStyle: React.CSSProperties = {
  width: "100%",
  height: "auto",
  objectFit: "contain",
  display: "block",
};
