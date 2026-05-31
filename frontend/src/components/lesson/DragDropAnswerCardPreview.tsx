import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./dragDropAnswerCardPreview.css";

const HOVER_DELAY_MS = 280;

function canUseHoverPreview(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function PreviewBody({
  answerText,
  imageSrc,
}: {
  answerText: string;
  imageSrc?: string | null;
}): React.ReactElement {
  return (
    <div className="ddm-answer-preview__body">
      {imageSrc ? (
        <img className="ddm-answer-preview__img" src={imageSrc} alt="" />
      ) : null}
      <p className="ddm-answer-preview__text">{answerText}</p>
    </div>
  );
}

export type AnswerCardPreviewShellProps = {
  /** When false, renders children only (default). */
  enablePreviewZoom?: boolean;
  answerText: string;
  imageSrc?: string | null;
  children: React.ReactNode;
};

/**
 * Magnify/zoom for compact drag-and-drop answer cards.
 * Portal popover (desktop hover) + modal (tap / focus / keyboard).
 * Does not affect parent layout or drag placement.
 */
export function AnswerCardPreviewShell({
  enablePreviewZoom = false,
  answerText,
  imageSrc = null,
  children,
}: AnswerCardPreviewShellProps): React.ReactElement {
  const [modalOpen, setModalOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const titleId = useId();

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const closeAll = useCallback(() => {
    setModalOpen(false);
    setHoverOpen(false);
    setAnchor(null);
    clearHoverTimer();
  }, [clearHoverTimer]);

  const openModal = useCallback(
    (e?: React.SyntheticEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      setHoverOpen(false);
      setAnchor(null);
      clearHoverTimer();
      setModalOpen(true);
    },
    [clearHoverTimer]
  );

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, closeAll]);

  if (!enablePreviewZoom) {
    return <>{children}</>;
  }

  const scheduleHover = () => {
    if (!canUseHoverPreview() || modalOpen) return;
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
      setHoverOpen(true);
    }, HOVER_DELAY_MS);
  };

  const cancelHover = () => {
    clearHoverTimer();
    setHoverOpen(false);
    setAnchor(null);
  };

  const popover =
    hoverOpen && anchor && !modalOpen
      ? createPortal(
          <div
            className="ddm-answer-preview__popover"
            style={{ top: anchor.top, left: anchor.left }}
            role="tooltip"
            data-testid="ddm-answer-preview-popover"
          >
            <PreviewBody answerText={answerText} imageSrc={imageSrc} />
          </div>,
          document.body
        )
      : null;

  const modal = modalOpen
    ? createPortal(
        <div
          className="ddm-answer-preview__backdrop"
          data-testid="ddm-answer-preview-backdrop"
          onClick={closeAll}
        >
          <div
            className="ddm-answer-preview__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="ddm-answer-preview-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <p id={titleId} className="ddm-answer-preview__sr-title">
              Enlarged answer preview
            </p>
            <PreviewBody answerText={answerText} imageSrc={imageSrc} />
            <button type="button" className="ddm-answer-preview__close" onClick={closeAll}>
              Close
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <span
        ref={wrapRef}
        className="ddm-answer-preview__wrap"
        onMouseEnter={scheduleHover}
        onMouseLeave={cancelHover}
      >
        {children}
        <span
          role="button"
          tabIndex={0}
          className="ddm-answer-preview__zoom-btn"
          aria-label={`Enlarge preview: ${answerText}`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={openModal}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openModal(e);
            }
          }}
          onFocus={() => {
            if (!canUseHoverPreview()) openModal();
          }}
        >
          <span aria-hidden="true">🔍</span>
        </span>
      </span>
      {popover}
      {modal}
    </>
  );
}
