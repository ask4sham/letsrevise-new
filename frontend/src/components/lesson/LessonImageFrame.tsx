import React, { useCallback } from "react";
import { hasRenderableLessonImageSrc, LESSON_IMAGE_FRAME_SELECTOR } from "../../constants/lessonImageDisplay";
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
   * When set and {@link LessonImageLightboxProvider} wraps the tree, clicking the card opens a full-screen lightbox.
   * Should match the displayed &lt;img&gt; src (absolute or same-origin path).
   */
  lightboxSrc?: string | null;
};

/** Hide broken/empty images and the surrounding card (avoids blank boxes). */
export function hideBrokenLessonImage(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.style.display = "none";
  const frame = img.closest(LESSON_IMAGE_FRAME_SELECTOR);
  if (frame instanceof HTMLElement) frame.style.display = "none";
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

  const canLightbox = Boolean(
    lightbox && lightboxSrc && hasRenderableLessonImageSrc(lightboxSrc)
  );

  const onActivate = useCallback(() => {
    if (canLightbox && lightboxSrc) lightbox!.open(lightboxSrc.trim());
  }, [canLightbox, lightbox, lightboxSrc]);

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
      data-lesson-lightbox-src={canLightbox && lightboxSrc ? lightboxSrc.trim() : undefined}
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
