import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  collectVisibleLessonLightboxItems,
  indexOfLightboxSrc,
} from "./lessonLightboxCollect";
import type { LessonLightboxItem } from "./lessonLightboxCollect";
import { makeAbsoluteAssetUrl } from "../../utils/assetUrl";
import { ZoomableImageLightbox } from "./ZoomableImageLightbox";
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
 * Collects visible `[data-lesson-lightbox-src]` frames for gallery mode; opens {@link ZoomableImageLightbox}.
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

  const value = useMemo(() => ({ open, close }), [open, close]);

  const overlay =
    openState &&
    openState.items.length > 0 &&
    (() => {
      const item = openState.items[openState.index];
      const resolvedSrc = makeAbsoluteAssetUrl(item.src) ?? item.src;
      const gallery =
        openState.items.length > 1
          ? {
              items: openState.items.map((i) => ({
                src: makeAbsoluteAssetUrl(i.src) ?? i.src,
                alt: i.alt,
              })),
              activeIndex: openState.index,
              onPrev: goPrev,
              onNext: goNext,
            }
          : undefined;
      return (
        <ZoomableImageLightbox
          src={resolvedSrc}
          alt={item.alt ?? ""}
          onClose={close}
          gallery={gallery}
        />
      );
    })();

  return (
    <LessonImageLightboxContext.Provider value={value}>
      {children}
      {overlay}
    </LessonImageLightboxContext.Provider>
  );
}
