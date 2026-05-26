import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { LessonLightboxItem } from "./lessonLightboxCollect";

type Props = {
  items: LessonLightboxItem[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

function capLightboxImageToNaturalSize(img: HTMLImageElement) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return;
  const maxW = Math.min(nw * 1.2, window.innerWidth * 0.9, 900);
  const maxH = Math.min(nh * 1.2, window.innerHeight * 0.85);
  img.style.width = "auto";
  img.style.height = "auto";
  img.style.maxWidth = `${maxW}px`;
  img.style.maxHeight = `${maxH}px`;
}

/**
 * Simple full-screen lightbox: large static image, no zoom/pinch/magnify.
 * Gallery: prev/next/arrow keys; always: backdrop click, X, Escape.
 */
export function LessonLightboxPanel({ items, activeIndex, onClose, onPrev, onNext }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const item = items[activeIndex];
  const gallery = items.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (!gallery) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [gallery, onClose, onPrev, onNext]);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const selector =
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => {
      const nl = root.querySelectorAll<HTMLElement>(selector);
      const out: HTMLElement[] = [];
      for (let i = 0; i < nl.length; i++) {
        const el = nl[i];
        if (!el.hasAttribute("disabled")) out.push(el);
      }
      return out;
    };
    const list = getFocusable();
    const first = list[0];
    const last = list[list.length - 1];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || list.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [items.length, activeIndex]);

  if (!item) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="lesson-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Lesson image viewer"
      onClick={onClose}
    >
      <div className="lesson-lightbox-dialog" onClick={(ev) => ev.stopPropagation()}>
        <div className="lesson-lightbox-toolbar">
          {gallery ? (
            <span className="lesson-lightbox-counter" aria-live="polite">
              {activeIndex + 1} / {items.length}
            </span>
          ) : (
            <span className="lesson-lightbox-counter lesson-lightbox-counter--ghost" />
          )}
          <button
            type="button"
            className="lesson-lightbox-icon-btn"
            aria-label="Close image"
            onClick={onClose}
          >
            <X size={22} strokeWidth={2.25} />
          </button>
        </div>

        <div className="lesson-lightbox-stage">
          {gallery && (
            <button
              type="button"
              className="lesson-lightbox-nav lesson-lightbox-nav--prev"
              aria-label="Previous image"
              onClick={(ev) => {
                ev.stopPropagation();
                onPrev();
              }}
            >
              <ChevronLeft size={36} strokeWidth={2} />
            </button>
          )}

          <div className="lesson-lightbox-viewport">
            <img
              key={`${activeIndex}-${item.src}`}
              src={item.src}
              alt={item.alt || ""}
              className="lesson-lightbox-img"
              draggable={false}
              onLoad={(e) => capLightboxImageToNaturalSize(e.currentTarget)}
            />
          </div>

          {gallery && (
            <button
              type="button"
              className="lesson-lightbox-nav lesson-lightbox-nav--next"
              aria-label="Next image"
              onClick={(ev) => {
                ev.stopPropagation();
                onNext();
              }}
            >
              <ChevronRight size={36} strokeWidth={2} />
            </button>
          )}
        </div>

        {item.alt ? <div className="lesson-lightbox-caption">{item.alt}</div> : null}
      </div>
    </div>,
    document.body
  );
}
