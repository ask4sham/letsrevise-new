import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { makeAbsoluteAssetUrl, resolveFullResolutionImageUrlForLightbox } from "../../utils/assetUrl";
import { lockBodyScroll } from "../../utils/bodyScrollLock";
import "./ZoomableImageLightbox.css";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export type ZoomableImageLightboxItem = {
  src: string;
  alt?: string;
};

type GalleryProps = {
  items: ZoomableImageLightboxItem[];
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
};

type LightboxProps = {
  src: string;
  alt?: string;
  onClose: () => void;
  gallery?: GalleryProps;
};

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function touchDistanceFromEvent(e: React.TouchEvent): number {
  if (e.touches.length < 2) return 0;
  const a = e.touches[0];
  const b = e.touches[1];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function resolveLightboxSrc(url: string): string {
  const trimmed = url.trim();
  const resolved = resolveFullResolutionImageUrlForLightbox(trimmed);
  return makeAbsoluteAssetUrl(resolved) ?? resolved;
}

/** Platform-wide full-screen zoomable image viewer — wheel, pinch, drag pan, gallery, keyboard. */
export function ZoomableImageLightbox({ src, alt = "", onClose, gallery }: LightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const translateRef = useRef(translate);
  translateRef.current = translate;

  const galleryMode = Boolean(gallery && gallery.items.length > 1);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setDragging(false);
    dragStart.current = null;
    pinchStart.current = null;
  }, []);

  // Reset zoom/pan only when switching images in gallery — not during pan/zoom on the same image.
  useEffect(() => {
    resetView();
  }, [src, gallery?.activeIndex, resetView]);

  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        resetView();
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((s) => clampScale(s + 0.2));
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        setScale((s) => {
          const next = clampScale(s - 0.2);
          if (next <= 1) setTranslate({ x: 0, y: 0 });
          return next;
        });
        return;
      }
      if (!gallery) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        gallery.onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        gallery.onNext();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [gallery, onClose, resetView]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const selector =
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !el.hasAttribute("disabled")
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusable.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    root.addEventListener("keydown", onTab);
    return () => root.removeEventListener("keydown", onTab);
  }, [gallery?.activeIndex]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setScale((s) => {
      const next = clampScale(s + delta);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    const t = translateRef.current;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragStart.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragStart.current = null;
    setDragging(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = { dist: touchDistanceFromEvent(e), scale };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const dist = touchDistanceFromEvent(e);
      if (pinchStart.current.dist > 0) {
        const ratio = dist / pinchStart.current.dist;
        const next = clampScale(pinchStart.current.scale * ratio);
        setScale(next);
        if (next <= 1) setTranslate({ x: 0, y: 0 });
      }
    }
  };

  const onTouchEnd = () => {
    pinchStart.current = null;
  };

  const zoomIn = () => setScale((s) => clampScale(s + 0.25));
  const zoomOut = () =>
    setScale((s) => {
      const next = clampScale(s - 0.25);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      return next;
    });

  const lightboxSrc = resolveLightboxSrc(src);

  return createPortal(
    <div
      className="zoomable-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Expanded image viewer"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="zoomable-image-lightbox__dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="zoomable-image-lightbox__toolbar">
          <div className="zoomable-image-lightbox__zoom-controls">
            {galleryMode && gallery ? (
              <span className="zoomable-image-lightbox__counter" aria-live="polite">
                {gallery.activeIndex + 1} / {gallery.items.length}
              </span>
            ) : null}
            <button
              type="button"
              className="zoomable-image-lightbox__btn"
              aria-label="Zoom out"
              onClick={zoomOut}
            >
              −
            </button>
            <span className="zoomable-image-lightbox__zoom-label" aria-live="polite">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              className="zoomable-image-lightbox__btn"
              aria-label="Zoom in"
              onClick={zoomIn}
            >
              +
            </button>
            <button
              type="button"
              className="zoomable-image-lightbox__btn zoomable-image-lightbox__btn--text"
              aria-label="Reset zoom"
              onClick={resetView}
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            className="zoomable-image-lightbox__btn zoomable-image-lightbox__close"
            aria-label="Close image viewer"
            onClick={onClose}
          >
            <X size={22} strokeWidth={2.25} />
          </button>
        </div>

        <div className="zoomable-image-lightbox__stage-wrap">
          {galleryMode && gallery ? (
            <button
              type="button"
              className="zoomable-image-lightbox__nav zoomable-image-lightbox__nav--prev"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                gallery.onPrev();
              }}
            >
              <ChevronLeft size={32} strokeWidth={2} />
            </button>
          ) : null}

          <div
            className={`zoomable-image-lightbox__viewport${dragging ? " zoomable-image-lightbox__viewport--dragging" : ""}${scale > 1 ? " zoomable-image-lightbox__viewport--pannable" : ""}`}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="zoomable-image-lightbox__stage"
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              }}
            >
              <img
                key={lightboxSrc}
                src={lightboxSrc}
                alt={alt}
                className="zoomable-image-lightbox__img"
                draggable={false}
              />
            </div>
          </div>

          {galleryMode && gallery ? (
            <button
              type="button"
              className="zoomable-image-lightbox__nav zoomable-image-lightbox__nav--next"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                gallery.onNext();
              }}
            >
              <ChevronRight size={32} strokeWidth={2} />
            </button>
          ) : null}
        </div>

        <div className="zoomable-image-lightbox__hint">
          <p className="zoomable-image-lightbox__hint-main">
            Use your mouse wheel or pinch to zoom. Drag to move the image. Press Esc to close.
          </p>
          <p className="zoomable-image-lightbox__hint-keys">
            <kbd>+</kbd> Zoom in · <kbd>−</kbd> Zoom out · <kbd>0</kbd> Reset · <kbd>Esc</kbd> Close
            {galleryMode ? (
              <>
                {" "}
                · <kbd>←</kbd> <kbd>→</kbd> Previous / next image
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

type TriggerProps = {
  src: string;
  alt?: string;
  lightboxSrc?: string;
  className?: string;
  imageClassName?: string;
  disabled?: boolean;
};

/**
 * Clickable image with magnifying-glass hint — opens {@link ZoomableImageLightbox}.
 * Use for standalone images outside {@link LessonImageFrame} (e.g. exam question blocks).
 */
export function ZoomableImageTrigger({
  src,
  alt = "",
  lightboxSrc,
  className = "",
  imageClassName = "",
  disabled = false,
}: TriggerProps) {
  const [open, setOpen] = useState(false);
  const displaySrc = makeAbsoluteAssetUrl(src.trim()) ?? src.trim();
  const resolvedLightbox = resolveLightboxSrc(lightboxSrc ?? src);

  if (!displaySrc || disabled) {
    return displaySrc ? (
      <img src={displaySrc} alt={alt} className={imageClassName} />
    ) : null;
  }

  return (
    <>
      <div className={`zoomable-image-trigger ${className}`.trim()}>
        <button
          type="button"
          className="zoomable-image-trigger__hit"
          aria-label="Expand image"
          onClick={() => setOpen(true)}
        >
          <img src={displaySrc} alt={alt} className={imageClassName} />
          <span className="zoomable-image-trigger__icon" aria-hidden="true">
            <ZoomIn size={18} strokeWidth={2.25} />
          </span>
        </button>
      </div>
      {open ? (
        <ZoomableImageLightbox
          src={resolvedLightbox}
          alt={alt}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
