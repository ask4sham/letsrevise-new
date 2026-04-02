import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { LessonLightboxItem } from "./lessonLightboxCollect";

const HOVER_ZOOM = 1.75;
const PINCH_MIN = 1;
const PINCH_MAX = 4;
const SWIPE_PX = 56;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}

type Props = {
  items: LessonLightboxItem[];
  activeIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Full-screen lightbox: gallery, desktop hover zoom (fine pointer only), touch pinch/pan, swipe navigation when not zoomed.
 */
export function LessonLightboxPanel({ items, activeIndex, onClose, onPrev, onNext }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isCoarsePointer = useCoarsePointer();

  const item = items[activeIndex];
  const gallery = items.length > 1;

  const [hoverZoom, setHoverZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  const [touchScale, setTouchScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchScaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    touchScaleRef.current = touchScale;
  }, [touchScale]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchBase = useRef({ dist: 0, scale: 1 });
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const swipeRef = useRef<{ x: number; y: number; sawMulti: boolean } | null>(null);

  useEffect(() => {
    setHoverZoom(false);
    setOrigin({ x: 50, y: 50 });
    setTouchScale(1);
    setPan({ x: 0, y: 0 });
    pointers.current.clear();
    pinchBase.current = { dist: 0, scale: 1 };
    panStart.current = null;
    swipeRef.current = null;
  }, [activeIndex]);

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

  const pointerDistance = useCallback(() => {
    const m = pointers.current;
    if (m.size < 2) return 0;
    let p0: { x: number; y: number } | null = null;
    let p1: { x: number; y: number } | null = null;
    let n = 0;
    m.forEach((pt) => {
      if (n === 0) p0 = pt;
      else if (n === 1) p1 = pt;
      n++;
    });
    if (!p0 || !p1) return 0;
    return Math.hypot(p1.x - p0.x, p1.y - p0.y);
  }, []);

  const onPointerDownViewport = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const el = viewportRef.current;
      if (!el) return;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2) {
        const d = pointerDistance();
        pinchBase.current = { dist: Math.max(d, 1), scale: touchScaleRef.current };
        swipeRef.current = null;
        panStart.current = null;
      } else if (pointers.current.size === 1) {
        swipeRef.current = { x: e.clientX, y: e.clientY, sawMulti: false };
        if (touchScaleRef.current > 1.02) {
          panStart.current = {
            x: e.clientX,
            y: e.clientY,
            panX: panRef.current.x,
            panY: panRef.current.y,
          };
        }
      }
    },
    [pointerDistance]
  );

  const onPointerMoveViewport = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size >= 2) {
        if (swipeRef.current) swipeRef.current.sawMulti = true;
        const d = pointerDistance();
        const { dist, scale } = pinchBase.current;
        if (dist > 0) {
          const next = clamp(scale * (d / dist), PINCH_MIN, PINCH_MAX);
          setTouchScale(next);
        }
        return;
      }

      if (pointers.current.size === 1 && panStart.current && touchScaleRef.current > 1.02) {
        const p0 = panStart.current;
        const dx = e.clientX - p0.x;
        const dy = e.clientY - p0.y;
        setPan({ x: p0.panX + dx, y: p0.panY + dy });
      }
    },
    [pointerDistance]
  );

  const onPointerUpViewport = useCallback(
    (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 1) {
        pinchBase.current = {
          dist: pointerDistance(),
          scale: touchScaleRef.current,
        };
      }
      if (pointers.current.size < 2) {
        pinchBase.current = { dist: 0, scale: touchScaleRef.current };
      }
      panStart.current = null;

      if (e.pointerType === "touch" && pointers.current.size === 0 && gallery) {
        const swipe = swipeRef.current;
        swipeRef.current = null;
        if (!swipe || swipe.sawMulti) return;
        if (touchScaleRef.current > 1.08) return;
        const dx = e.clientX - swipe.x;
        const dy = e.clientY - swipe.y;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
        if (dx > 0) onPrev();
        else onNext();
      }
    },
    [gallery, onNext, onPrev, pointerDistance]
  );

  const onMouseMoveViewport = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isCoarsePointer) return;
      const el = viewportRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = clamp(((e.clientX - r.left) / Math.max(r.width, 1)) * 100, 0, 100);
      const y = clamp(((e.clientY - r.top) / Math.max(r.height, 1)) * 100, 0, 100);
      setOrigin({ x, y });
    },
    [isCoarsePointer]
  );

  const imgTransform = useMemo(() => {
    if (isCoarsePointer) {
      return {
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${touchScale})`,
        transformOrigin: "center center",
        transition: "none",
      } as const;
    }
    return {
      transform: hoverZoom ? `scale(${HOVER_ZOOM})` : "scale(1)",
      transformOrigin: `${origin.x}% ${origin.y}%`,
      transition: hoverZoom ? "transform 0.1s ease-out" : "transform 0.2s ease-out",
    } as const;
  }, [isCoarsePointer, pan.x, pan.y, touchScale, hoverZoom, origin.x, origin.y]);

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

          <div
            ref={viewportRef}
            className="lesson-lightbox-viewport"
            onPointerDown={onPointerDownViewport}
            onPointerMove={onPointerMoveViewport}
            onPointerUp={onPointerUpViewport}
            onPointerCancel={onPointerUpViewport}
            onMouseEnter={() => {
              if (!isCoarsePointer) setHoverZoom(true);
            }}
            onMouseLeave={() => {
              if (!isCoarsePointer) {
                setHoverZoom(false);
                setOrigin({ x: 50, y: 50 });
              }
            }}
            onMouseMove={onMouseMoveViewport}
          >
            <img
              key={`${activeIndex}-${item.src}`}
              src={item.src}
              alt={item.alt || ""}
              className="lesson-lightbox-img"
              draggable={false}
              style={imgTransform}
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
