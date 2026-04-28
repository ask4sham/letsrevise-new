import React, { useState, useCallback, useRef, useEffect, useMemo, useId } from "react";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  buildCaptionQuizOptions,
  captionsMatchChosen,
  formatInteractiveSequenceMcqOptionDisplay,
} from "../../utils/interactiveSequenceStepQuiz";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import "./interactiveSequenceBlock.css";

export type InteractiveSequenceStep = {
  /** Optional stable id (templates / editor); list keys fall back to index. */
  id?: string;
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

function getMcqCorrectFeedbackDetail(stepTitle: string): string {
  const st = stepTitle.trim() || "this stage";
  return `Good — this matches what happens during ${st}.`;
}

/** Deterministic mismatch copy for wrong selections (biology-style heuristics; no backend). */
function getWrongAnswerExplanation(selectedText: string, correctText: string, stepTitle: string): string {
  const lower = (selectedText ?? "").trim().toLowerCase();
  const correctLower = (correctText ?? "").trim().toLowerCase();
  const st = (stepTitle ?? "").trim() || "this stage";

  if (!correctLower) {
    return `Not quite — rethink what happens during ${st}.`;
  }

  if (lower.includes("splits") || lower.includes("daughter cells")) {
    return `Not quite — that describes cytokinesis. During ${st}, ${correctLower}.`;
  }

  if (lower.includes("condense") || lower.includes("nuclear membrane")) {
    return `Not quite — that describes prophase. During ${st}, ${correctLower}.`;
  }

  if (lower.includes("line up") || lower.includes("centre") || lower.includes("center") || lower.includes("equator")) {
    return `Not quite — that describes metaphase. During ${st}, ${correctLower}.`;
  }

  if (
    lower.includes("dna replicates") ||
    lower.includes("dna replicate") ||
    lower.includes("prepares for division") ||
    lower.includes("prepares for cell division")
  ) {
    return `Not quite — that describes interphase (or synthesis). During ${st}, ${correctLower}.`;
  }

  if (lower.includes("nuclei") || lower.includes("nuclear membranes")) {
    return `Not quite — that describes telophase. During ${st}, ${correctLower}.`;
  }

  return `Not quite — during ${st}, ${correctLower}.`;
}

/**
 * Step-by-step interactive sequence for lesson content (mitosis, procedures, etc.).
 * Data from the lesson block; optional “Test me on this” MCQ uses local state only (no save).
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
  const captionTrimmed = (step?.caption ?? "").trim();

  const [mcqSelection, setMcqSelection] = useState<string | null>(null);
  const [mcqRevealed, setMcqRevealed] = useState(false);
  const [testPanelExpanded, setTestPanelExpanded] = useState(true);
  const testPanelBodyId = useId();

  const mcqOptions = useMemo(
    () => (captionTrimmed ? buildCaptionQuizOptions(captionTrimmed, safeIndex) : []),
    [captionTrimmed, safeIndex]
  );

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
    setMcqSelection(null);
    setMcqRevealed(false);
    setTestPanelExpanded(true);
  }, [safeIndex, captionTrimmed]);

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
  const mcqIsCorrect =
    mcqRevealed &&
    mcqSelection != null &&
    captionsMatchChosen(mcqSelection, captionTrimmed);

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
              <p className="interactive-sequence__explanation-text">{step?.description?.trim() || "—"}</p>
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

          {captionTrimmed && mcqOptions.length > 0 ? (
            <div
              className={`interactive-sequence__test-card${
                testPanelExpanded ? " interactive-sequence__test-card--expanded" : " interactive-sequence__test-card--collapsed"
              }`}
              aria-live="polite"
              key={safeIndex}
            >
              <div className="interactive-sequence__test-head">
                <button
                  type="button"
                  className="interactive-sequence__test-toggle"
                  aria-expanded={testPanelExpanded}
                  aria-controls={testPanelBodyId}
                  onClick={() => setTestPanelExpanded((prev) => !prev)}
                  title={testPanelExpanded ? "Collapse" : "Expand"}
                >
                  <span aria-hidden>{testPanelExpanded ? "▾" : "▸"}</span>
                </button>
                <p className="interactive-sequence__test-title">
                  <span aria-hidden>🧠</span>
                  <span>Test me on this</span>
                </p>
              </div>

              <div
                id={testPanelBodyId}
                className="interactive-sequence__test-panel"
                hidden={!testPanelExpanded}
              >
                <p className="interactive-sequence__test-question">What happens during this stage?</p>
                <div className="interactive-sequence__test-options" role="group" aria-label="Answer choices">
                  {mcqOptions.map((opt, oi) => {
                    const isChosen = mcqSelection === opt;
                    const showResult = mcqRevealed && isChosen;
                    const optionMods = [
                      "interactive-sequence__test-option",
                      !mcqRevealed && isChosen ? "interactive-sequence__test-option--selected" : "",
                      showResult && mcqIsCorrect ? "interactive-sequence__test-option--correct" : "",
                      showResult && !mcqIsCorrect ? "interactive-sequence__test-option--incorrect" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    /** Only after a wrong submission: reveal which option was correct (hint icon). Never before Check answer. */
                    const showCorrectHintIcon =
                      mcqRevealed &&
                      !mcqIsCorrect &&
                      captionsMatchChosen(opt, captionTrimmed);

                    return (
                      <button
                        key={`seq-mcq-${safeIndex}-${oi}`}
                        type="button"
                        className={optionMods}
                        disabled={mcqRevealed}
                        onClick={() => setMcqSelection(opt)}
                        aria-pressed={isChosen ? true : undefined}
                      >
                        {showCorrectHintIcon ? (
                          <>
                            <span aria-hidden>💡</span>{" "}
                          </>
                        ) : null}
                        {formatInteractiveSequenceMcqOptionDisplay(opt)}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="interactive-sequence__test-check-btn"
                  disabled={mcqSelection == null || mcqRevealed}
                  onClick={() => setMcqRevealed(true)}
                >
                  Check answer
                </button>
                {mcqRevealed && mcqSelection != null ? (
                  <div
                    className={
                      mcqIsCorrect
                        ? "interactive-sequence__test-feedback interactive-sequence__test-feedback--correct"
                        : "interactive-sequence__test-feedback interactive-sequence__test-feedback--incorrect"
                    }
                  >
                    <p className="interactive-sequence__test-feedback__verdict">
                      {mcqIsCorrect ? "✅ Correct" : "❌ Not quite"}
                    </p>
                    <p className="interactive-sequence__test-feedback-detail">
                      {mcqIsCorrect
                        ? getMcqCorrectFeedbackDetail(step?.title?.trim() ?? "")
                        : getWrongAnswerExplanation(mcqSelection, captionTrimmed, step?.title?.trim() ?? "")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
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
