import React, { useState, useCallback, useRef, useEffect, useId } from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import { stripSequenceStepImagePromptFromDescription } from "../../utils/interactiveSequenceStepImagePrompt";
import { AssessmentFeedback } from "./AssessmentFeedback";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import "./interactiveSequenceBlock.css";

export type InteractiveSequenceStep = {
  /** Optional stable id (templates / editor); list keys fall back to index. */
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  /** Model answer / key idea — revealed on demand (formerly “Test me” MCQ caption). */
  caption: string;
  /** Optional — second line in AssessmentFeedback after reveal with the key idea. */
  testExplanation?: string;
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
 * Optional “Test me” content (caption + optional testExplanation) is hidden until students choose Reveal,
 * then shown via AssessmentFeedback — same pattern as other assessment blocks.
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
  const descriptionStudent = stripSequenceStepImagePromptFromDescription(String(step?.description ?? ""));
  const captionTrimmed = (step?.caption ?? "").trim();
  const testExplanationTrimmed =
    step?.testExplanation != null ? String(step.testExplanation).trim() : "";

  const [answerRevealed, setAnswerRevealed] = useState(false);
  const revealBodyId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const stepBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const skipInitialScrollRef = useRef(true);

  const go = useCallback(
    (next: number) => {
      if (list.length === 0) return;
      setActive((i) => Math.min(list.length - 1, Math.max(0, next)));
    },
    [list.length]
  );

  const onArrowNav = useCallback(
    (e: React.KeyboardEvent) => {
      if (list.length === 0) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      if (e.key === "ArrowLeft") go(safeIndex - 1);
      else go(safeIndex + 1);
    },
    [go, list.length, safeIndex]
  );

  useEffect(() => {
    setAnswerRevealed(false);
  }, [safeIndex, captionTrimmed, testExplanationTrimmed]);

  /** After step changes: scroll layout into view; keep active step visible in the sidebar list. */
  useEffect(() => {
    if (list.length === 0) return;
    if (skipInitialScrollRef.current) {
      skipInitialScrollRef.current = false;
      return;
    }
    const prefersReduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behave = prefersReduced ? ("auto" as const) : ("smooth" as const);
    layoutRef.current?.scrollIntoView({
      behavior: behave,
      block: "nearest",
      inline: "nearest",
    });
    requestAnimationFrame(() => {
      stepBtnRefs.current[safeIndex]?.scrollIntoView({
        behavior: behave,
        block: "nearest",
        inline: "center",
      });
    });
  }, [safeIndex, list.length]);

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
  const total = list.length;
  const stepNum = safeIndex + 1;
  const isOnFinalStep = safeIndex === list.length - 1;
  const hasTestMe = Boolean(captionTrimmed);

  return (
    <div
      className="interactive-sequence"
      ref={rootRef}
      role="region"
      tabIndex={0}
      aria-label={blockTitle.trim() || "Step-by-step activity"}
      onKeyDown={onArrowNav}
    >
      {blockTitle.trim() ? <h3 className="interactive-sequence__main-title">{blockTitle}</h3> : null}
      {intro.trim() ? <p className="interactive-sequence__intro">{intro}</p> : null}

      <div
        className={`interactive-sequence__layout${isOnFinalStep ? " interactive-sequence__layout--complete" : ""}`}
        ref={layoutRef}
      >
        <div className="interactive-sequence__media-card">
          <div className="interactive-sequence__media-zone">
            <div key={safeIndex} className="interactive-sequence__fade-slot interactive-sequence__fade-slot--media">
              {showImg ? (
                <LessonImageFrame variant="primary" lightboxSrc={imgResolved}>
                  <img
                    className="interactive-sequence__image"
                    src={imgResolved}
                    alt={step?.title?.trim() || "Step illustration"}
                    onError={hideBrokenLessonImage}
                  />
                </LessonImageFrame>
              ) : (
                <div className="interactive-sequence__image-placeholder" role="status">
                  <p className="interactive-sequence__image-placeholder-text">
                    Add an image for this step (optional but recommended)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="interactive-sequence__body-card">
          <div className="interactive-sequence__detail">
            <div key={safeIndex} className="interactive-sequence__fade-slot interactive-sequence__fade-slot--text">
              <p className="interactive-sequence__step-of">
                Step {stepNum} of {total}
              </p>
              {step?.title ? <h4 className="interactive-sequence__step-title">{step.title}</h4> : null}
              <p className="interactive-sequence__explanation-text">{descriptionStudent.trim() || "—"}</p>

              {hasTestMe ? (
                <div
                  className="interactive-sequence__reveal-card"
                  role="region"
                  aria-labelledby={`${revealBodyId}-label`}
                >
                  <p className="interactive-sequence__reveal-label" id={`${revealBodyId}-label`}>
                    <span aria-hidden>🧠</span> Test me
                  </p>
                  {!answerRevealed ? (
                    <button
                      type="button"
                      className="interactive-sequence__reveal-btn"
                      aria-expanded={false}
                      aria-controls={revealBodyId}
                      onClick={() => setAnswerRevealed(true)}
                    >
                      Reveal answer / key idea
                    </button>
                  ) : (
                    <div id={revealBodyId} className="interactive-sequence__reveal-body">
                      <AssessmentFeedback
                        answer={captionTrimmed}
                        answerLabel="Answer / Key idea"
                        explanation={testExplanationTrimmed || undefined}
                        explanationLabel="Explanation"
                      />
                      <button
                        type="button"
                        className="interactive-sequence__reveal-hide-btn"
                        onClick={() => setAnswerRevealed(false)}
                        aria-expanded={true}
                      >
                        Hide
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {isOnFinalStep ? (
            <div className="interactive-sequence__complete" role="status" aria-live="polite">
              <span className="interactive-sequence__complete-badge">✓ Process complete</span>
            </div>
          ) : null}
        </div>

        <aside className="interactive-sequence__sidebar" aria-labelledby="interactive-sequence-steps-heading">
          <div className="interactive-sequence__sidebar-title" id="interactive-sequence-steps-heading">
            Steps
          </div>
          <nav className="interactive-sequence__step-nav" aria-label="Steps">
            <ol className="interactive-sequence__step-list">
              {list.map((s, i) => {
                const isActive = i === safeIndex;
                const sk = s.id?.trim() || `step-${i}`;
                return (
                  <li key={sk} className="interactive-sequence__step-list-item">
                    <button
                      ref={(el) => {
                        stepBtnRefs.current[i] = el;
                      }}
                      type="button"
                      className={
                        isActive
                          ? "interactive-sequence__step-button interactive-sequence__step-button--active"
                          : "interactive-sequence__step-button"
                      }
                      onClick={() => go(i)}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <span className="interactive-sequence__step-number" aria-hidden>
                        {i + 1}
                      </span>
                      <span className="interactive-sequence__step-label">
                        {s.title?.trim() || `Step ${i + 1}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        <nav className="interactive-sequence__nav" aria-label="Step navigation">
          <button
            type="button"
            className="interactive-sequence__btn interactive-sequence__btn--prev"
            onClick={() => go(safeIndex - 1)}
            disabled={safeIndex <= 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="interactive-sequence__btn interactive-sequence__btn--next"
            onClick={() => go(safeIndex + 1)}
            disabled={safeIndex >= list.length - 1}
          >
            Next
          </button>
        </nav>
      </div>
    </div>
  );
}
