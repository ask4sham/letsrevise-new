import React, { useState, useCallback } from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import "./interactiveSequenceBlock.css";

export type InteractiveSequenceStep = {
  title: string;
  description: string;
  imageUrl: string;
  caption: string;
};

export type InteractiveSequenceBlockProps = {
  blockTitle: string;
  intro: string;
  steps: InteractiveSequenceStep[];
  /** Resolve relative URLs to absolute (e.g. makeAbsoluteAssetUrl) */
  resolveImageUrl: (url: string) => string;
};

/**
 * Step-by-step interactive sequence for lesson content (mitosis, procedures, etc.).
 * Presentation only — data comes from the lesson block; no side effects.
 */
export function InteractiveSequenceBlock({
  blockTitle,
  intro,
  steps,
  resolveImageUrl,
}: InteractiveSequenceBlockProps): React.ReactElement {
  const list = Array.isArray(steps) && steps.length > 0 ? steps : [];
  const [active, setActive] = useState(0);
  const safeIndex = list.length > 0 ? Math.min(Math.max(0, active), list.length - 1) : 0;
  const step = list[safeIndex];
  const go = useCallback(
    (next: number) => {
      if (list.length === 0) return;
      setActive((i) => Math.min(list.length - 1, Math.max(0, next)));
    },
    [list.length]
  );

  if (list.length === 0) {
    return (
      <div className="interactive-sequence">
        {blockTitle.trim() ? <h3 className="interactive-sequence__main-title">{blockTitle}</h3> : null}
        <p className="interactive-sequence__empty">No steps in this activity yet.</p>
      </div>
    );
  }

  const imgRaw = (step?.imageUrl ?? "").trim();
  const imgResolved = imgRaw ? resolveImageUrl(imgRaw) : "";
  const showImg = hasRenderableLessonImageSrc(imgRaw) && hasRenderableLessonImageSrc(imgResolved);

  return (
    <div className="interactive-sequence">
      {blockTitle.trim() ? <h3 className="interactive-sequence__main-title">{blockTitle}</h3> : null}
      {intro.trim() ? <p className="interactive-sequence__intro">{intro}</p> : null}

      <div className="interactive-sequence__layout">
        <div className="interactive-sequence__main">
          {step?.title ? <div className="interactive-sequence__step-pill">Step {safeIndex + 1}</div> : null}
          {step?.title ? <h4 className="interactive-sequence__step-title">{step.title}</h4> : null}

          <div className="interactive-sequence__explanation-strip" role="region" aria-label="Step explanation">
            <p className="interactive-sequence__explanation-text">{step?.description?.trim() || "—"}</p>
          </div>

          <div className="interactive-sequence__image-wrap">
            {showImg ? (
              <LessonImageFrame variant="primary" lightboxSrc={imgResolved}>
                <img
                  className="interactive-sequence__image"
                  src={imgResolved}
                  alt={step?.caption?.trim() || step?.title || "Step illustration"}
                  onError={hideBrokenLessonImage}
                />
              </LessonImageFrame>
            ) : (
              <div className="interactive-sequence__image-placeholder" aria-hidden>
                Add an image for this step in the editor
              </div>
            )}
            {step?.caption?.trim() ? (
              <p className="interactive-sequence__caption">{step.caption.trim()}</p>
            ) : null}
          </div>

          <div className="interactive-sequence__nav">
            <button
              type="button"
              className="interactive-sequence__btn interactive-sequence__btn--prev"
              onClick={() => go(safeIndex - 1)}
              disabled={safeIndex <= 0}
            >
              Previous
            </button>
            <span className="interactive-sequence__progress" aria-live="polite">
              {safeIndex + 1} / {list.length}
            </span>
            <button
              type="button"
              className="interactive-sequence__btn interactive-sequence__btn--next"
              onClick={() => go(safeIndex + 1)}
              disabled={safeIndex >= list.length - 1}
            >
              Next
            </button>
          </div>
        </div>

        <nav className="interactive-sequence__sidebar" aria-label="Steps">
          <div className="interactive-sequence__sidebar-title">Steps</div>
          <ol className="interactive-sequence__step-list">
            {list.map((s, i) => {
              const isActive = i === safeIndex;
              return (
                <li key={i}>
                  <button
                    type="button"
                    className={
                      isActive
                        ? "interactive-sequence__side-btn interactive-sequence__side-btn--active"
                        : "interactive-sequence__side-btn"
                    }
                    onClick={() => go(i)}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span className="interactive-sequence__side-index">{i + 1}</span>
                    <span className="interactive-sequence__side-label">
                      {s.title?.trim() || `Step ${i + 1}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}
