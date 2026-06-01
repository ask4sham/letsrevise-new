import React, { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import "./ttiPlacedAnswerMagnify.css";

export type TtiPlacedAnswerMagnifyProps = {
  /** Original draggable concept card text (`pair.prompt`) — shown verbatim in modal. */
  conceptCard?: string;
  answer: string;
  explanation?: string;
  markerLabel?: string;
};

/**
 * Magnify control for correct TTI main-image boxed placements (post-check only).
 * Portal modal — does not affect drop-zone size or layout.
 */
export function TtiPlacedAnswerMagnify({
  conceptCard = "",
  answer,
  explanation = "",
  markerLabel = "",
}: TtiPlacedAnswerMagnifyProps): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const conceptStr = String(conceptCard ?? "").trim();
  const answerStr = String(answer ?? "").trim();
  const explainStr = String(explanation ?? "").trim();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!conceptStr && !answerStr && !explainStr) return null;

  const openModal = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const modal = open
    ? createPortal(
        <div
          className="tti-placed-magnify__backdrop"
          data-testid="tti-placed-magnify-backdrop"
          onClick={close}
        >
          <div
            className="tti-placed-magnify__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="tti-placed-magnify-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId} className="tti-placed-magnify__title">
              {markerLabel ? `Box ${markerLabel}` : "Answer details"}
            </h2>
            {conceptStr ? (
              <div className="tti-placed-magnify__section">
                <div className="tti-placed-magnify__label">Concept card</div>
                <p className="tti-placed-magnify__answer">{conceptStr}</p>
              </div>
            ) : null}
            {answerStr ? (
              <div className="tti-placed-magnify__section">
                <div className="tti-placed-magnify__label">Answer</div>
                <p className="tti-placed-magnify__answer">{answerStr}</p>
              </div>
            ) : null}
            {explainStr ? (
              <div className="tti-placed-magnify__section">
                <div className="tti-placed-magnify__label">Explanation</div>
                <div className="tti-placed-magnify__explain">{explainStr}</div>
              </div>
            ) : null}
            <button type="button" className="tti-placed-magnify__close" onClick={close}>
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
        role="button"
        tabIndex={0}
        className="tti-placed-magnify__btn"
        aria-label={
          markerLabel
            ? `View full answer for box ${markerLabel}`
            : `View full answer: ${answerStr || "placed answer"}`
        }
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={openModal}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal(e);
          }
        }}
      >
        <span aria-hidden="true">🔍</span>
      </span>
      {modal}
    </>
  );
}
