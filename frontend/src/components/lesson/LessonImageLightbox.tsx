import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  collectVisibleLessonLightboxItems,
  indexOfLightboxSrc,
} from "./lessonLightboxCollect";
import type { LessonLightboxItem } from "./lessonLightboxCollect";
import { LessonLightboxPanel } from "./LessonLightboxPanel";
import "./lessonImageCard.css";

export type { LessonLightboxItem } from "./lessonLightboxCollect";

type OpenState = { items: LessonLightboxItem[]; index: number };

type LightboxContextValue = {
  open: (src: string) => void;
  close: () => void;
};

const LessonImageLightboxContext = createContext<LightboxContextValue | null>(null);

export function useLessonImageLightbox(): LightboxContextValue | null {
  return useContext(LessonImageLightboxContext);
}

/**
 * Provides click-to-enlarge for lesson images ({@link LessonImageFrame} with `lightboxSrc`).
 * Collects visible `[data-lesson-lightbox-src]` frames for gallery mode; full-screen static image panel.
 */
export function LessonImageLightboxProvider({ children }: { children: React.ReactNode }) {
  const [openState, setOpenState] = useState<OpenState | null>(null);

  const close = useCallback(() => setOpenState(null), []);

  const open = useCallback((src: string) => {
    const trimmed = src.trim();
    if (!hasRenderableLessonImageSrc(trimmed)) return;

    const collected = collectVisibleLessonLightboxItems();
    if (collected.length === 0) {
      setOpenState({ items: [{ src: trimmed }], index: 0 });
      return;
    }

    const idx = indexOfLightboxSrc(collected, trimmed);
    if (idx < 0) {
      setOpenState({ items: [{ src: trimmed }], index: 0 });
      return;
    }

    setOpenState({ items: collected, index: idx });
  }, []);

  const goPrev = useCallback(() => {
    setOpenState((s) => {
      if (!s || s.items.length <= 1) return s;
      return { ...s, index: (s.index - 1 + s.items.length) % s.items.length };
    });
  }, []);

  const goNext = useCallback(() => {
    setOpenState((s) => {
      if (!s || s.items.length <= 1) return s;
      return { ...s, index: (s.index + 1) % s.items.length };
    });
  }, []);

  useEffect(() => {
    if (!openState) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [openState]);

  const value = useMemo(() => ({ open, close }), [open, close]);

  const overlay =
    openState &&
    openState.items.length > 0 && (
      <LessonLightboxPanel
        items={openState.items}
        activeIndex={openState.index}
        onClose={close}
        onPrev={goPrev}
        onNext={goNext}
      />
    );

  return (
    <LessonImageLightboxContext.Provider value={value}>
      {children}
      {overlay}
    </LessonImageLightboxContext.Provider>
  );
}
