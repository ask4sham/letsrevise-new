import React, { useState, useCallback, useEffect, useId, useLayoutEffect, useRef } from "react";
import { generateSequenceRecallFromStep, type SequenceRecallPayload } from "../../api/ai";
import { hasRenderableLessonImageSrc } from "../../constants/lessonImageDisplay";
import {
  deriveSequenceTestMeQuestion,
  resolveSequenceTestMeAnswer,
} from "../../utils/interactiveSequenceTestMe";
import { resolveLessonStepImageSrc } from "../../utils/assetUrl";
import { cleanSequenceStepDescription } from "../../utils/cleanSequenceStepDescription";
import { AssessmentFeedback } from "./AssessmentFeedback";
import { hideBrokenLessonImage, LessonImageFrame } from "./LessonImageFrame";
import "./interactiveSequenceBlock.css";
import "./student/lessonInteractiveSequenceCompactImage.css";
import { InteractiveSequenceIntro } from "./InteractiveSequenceIntro";

export type InteractiveSequenceStep = {
  /** Optional stable id (templates / editor); list keys fall back to index. */
  id?: string;
  title: string;
  description: string;
  imageUrl: string;
  /** Model answer / key idea — revealed on demand (formerly “Test me” MCQ caption). */
  caption: string;
  /** Optional recall question; when omitted, AI generates one in student view. */
  testQuestion?: string;
  /** Optional — second line in AssessmentFeedback after reveal with the key idea. */
  testExplanation?: string;
};

export type InteractiveSequenceBlockProps = {
  blockTitle: string;
  intro: string;
  steps: InteractiveSequenceStep[];
  /** Resolve relative URLs to absolute (e.g. makeAbsoluteAssetUrl) */
  resolveImageUrl: (url: string) => string;
  /** Lesson context for AI “Test me” questions (student view). */
  lessonTitle?: string;
  level?: string;
  subject?: string;
  /** When false, uses stored/derived text only (e.g. editor without lesson context). */
  enableAiTestMe?: boolean;
  /** Student view hides empty image placeholders. */
  viewMode?: "student" | "teacher" | "full";
  /**
   * When true, omit the block-level main title (outer SS1 heading already labels the frame).
   * Step titles / Test me content are unchanged.
   */
  hideBlockTitle?: boolean;
};

/**
 * Step-by-step interactive sequence for lesson content (mitosis, procedures, etc.).
 * “Test me” shows an AI-generated recall question; answer appears only after Reveal.
 */
export function InteractiveSequenceBlock({
  blockTitle,
  intro,
  steps,
  resolveImageUrl,
  lessonTitle,
  level,
  subject,
  enableAiTestMe = true,
  viewMode = "full",
  hideBlockTitle = false,
}: InteractiveSequenceBlockProps): React.ReactElement {
  const list = Array.isArray(steps) && steps.length > 0 ? steps : [];
  const [active, setActive] = useState(0);
  const scrollLockYRef = useRef<number | null>(null);
  const recallCacheRef = useRef<Map<string, SequenceRecallPayload>>(new Map());
  const safeIndex = list.length > 0 ? Math.min(Math.max(0, active), list.length - 1) : 0;
  const step = list[safeIndex];
  const descriptionStudent = cleanSequenceStepDescription(String(step?.description ?? ""), {
    stepTitle: step?.title,
    stepIndex: safeIndex,
  });
  const captionTrimmed = (step?.caption ?? "").trim();
  const storedQuestion = (step?.testQuestion ?? "").trim();
  const fallbackQuestion = deriveSequenceTestMeQuestion(step ?? {});
  const fallbackAnswer = resolveSequenceTestMeAnswer(step ?? {}, descriptionStudent);
  const testExplanationTrimmed =
    step?.testExplanation != null ? String(step.testExplanation).trim() : "";

  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [displayQuestion, setDisplayQuestion] = useState("");
  const [displayAnswer, setDisplayAnswer] = useState("");
  const [displayExplanation, setDisplayExplanation] = useState("");
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [testMeError, setTestMeError] = useState<string | null>(null);
  const revealBodyId = useId();

  const topicForAi = (lessonTitle ?? blockTitle ?? "").trim();
  const aiTestMeEnabled = enableAiTestMe !== false && Boolean(topicForAi || descriptionStudent.trim());
  const stepKey = (step?.id?.trim() || `step-${safeIndex}`).slice(0, 64);

  const preventClickFocusScroll = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button === 0) e.preventDefault();
  }, []);

  const blurStepControlAfterClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
  }, []);

  const resolveStepImage = useCallback(
    (url: string) => resolveLessonStepImageSrc(resolveImageUrl(url)),
    [resolveImageUrl]
  );

  const go = useCallback(
    (next: number) => {
      if (list.length === 0) return;
      const clamped = Math.min(list.length - 1, Math.max(0, next));
      if (clamped === safeIndex) return;
      scrollLockYRef.current = window.scrollY;
      setActive(clamped);
    },
    [list.length, safeIndex]
  );

  const restoreLockedScroll = useCallback(() => {
    const y = scrollLockYRef.current;
    if (y == null) return;
    window.scrollTo({ top: y, left: window.scrollX, behavior: "auto" });
  }, []);

  useLayoutEffect(() => {
    if (scrollLockYRef.current == null) return;
    restoreLockedScroll();
    const raf = requestAnimationFrame(restoreLockedScroll);
    const t0 = window.setTimeout(restoreLockedScroll, 0);
    const clearLock = window.setTimeout(() => {
      scrollLockYRef.current = null;
    }, 150);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t0);
      window.clearTimeout(clearLock);
    };
  }, [safeIndex, restoreLockedScroll]);

  useEffect(() => {
    list.forEach((s) => {
      const raw = (s.imageUrl ?? "").trim();
      if (!hasRenderableLessonImageSrc(raw)) return;
      const resolved = resolveStepImage(raw);
      if (!hasRenderableLessonImageSrc(resolved)) return;
      const img = new Image();
      img.src = resolved;
    });
  }, [list, resolveStepImage]);

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
  }, [safeIndex, captionTrimmed, testExplanationTrimmed, storedQuestion]);

  const hasTestMe = Boolean(captionTrimmed || descriptionStudent.trim());
  const anyStepHasTestMe = list.some((s, stepIdx) => {
    const cap = String(s.caption ?? "").trim();
    const desc = cleanSequenceStepDescription(String(s.description ?? ""), {
      stepTitle: s.title,
      stepIndex: stepIdx,
    }).trim();
    return Boolean(cap || desc);
  });

  useEffect(() => {
    if (!hasTestMe) {
      setDisplayQuestion("");
      setDisplayAnswer("");
      setDisplayExplanation("");
      setLoadingQuestion(false);
      setTestMeError(null);
      return;
    }

    const applyFallback = () => {
      setDisplayQuestion(storedQuestion || fallbackQuestion);
      setDisplayAnswer(fallbackAnswer);
      setDisplayExplanation(testExplanationTrimmed);
    };

    if (storedQuestion) {
      applyFallback();
      setTestMeError(null);
      setLoadingQuestion(false);
      return;
    }

    const cached = recallCacheRef.current.get(stepKey);
    if (cached) {
      setDisplayQuestion(cached.question);
      setDisplayAnswer(cached.answer || fallbackAnswer);
      setDisplayExplanation(cached.explanation || testExplanationTrimmed);
      setTestMeError(null);
      setLoadingQuestion(false);
      return;
    }

    if (!aiTestMeEnabled) {
      applyFallback();
      return;
    }

    let cancelled = false;
    setLoadingQuestion(true);
    setTestMeError(null);
    setDisplayQuestion("");
    setDisplayAnswer("");

    (async () => {
      try {
        const { recall, _disabled } = await generateSequenceRecallFromStep({
          topic: topicForAi,
          stepTitle: String(step?.title ?? `Step ${safeIndex + 1}`).trim(),
          stepDescription: descriptionStudent,
          keyIdeaHint: fallbackAnswer,
          level,
          subject,
        });
        if (cancelled) return;
        if (_disabled) {
          applyFallback();
          return;
        }
        recallCacheRef.current.set(stepKey, recall);
        setDisplayQuestion(recall.question);
        setDisplayAnswer(recall.answer || fallbackAnswer);
        setDisplayExplanation(recall.explanation || testExplanationTrimmed);
      } catch {
        if (!cancelled) {
          applyFallback();
          setTestMeError(null);
        }
      } finally {
        if (!cancelled) setLoadingQuestion(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    aiTestMeEnabled,
    descriptionStudent,
    fallbackAnswer,
    fallbackQuestion,
    hasTestMe,
    level,
    safeIndex,
    step?.title,
    stepKey,
    storedQuestion,
    subject,
    testExplanationTrimmed,
    topicForAi,
  ]);

  if (list.length === 0) {
    return (
      <div className="interactive-sequence">
        {!hideBlockTitle && blockTitle.trim() ? (
          <h3 className="interactive-sequence__main-title">{blockTitle}</h3>
        ) : null}
        <p className="interactive-sequence__empty">No steps in this activity yet.</p>
      </div>
    );
  }

  const imgRaw = (step?.imageUrl ?? "").trim();
  const imgResolved = imgRaw ? resolveStepImage(imgRaw) : "";
  const showImg = hasRenderableLessonImageSrc(imgRaw) && hasRenderableLessonImageSrc(imgResolved);
  const hideImagePlaceholder = viewMode === "student" && !showImg;
  const total = list.length;
  const stepNum = safeIndex + 1;
  const isOnFinalStep = safeIndex === list.length - 1;
  const questionReady = Boolean(displayQuestion.trim());

  return (
    <div
      className="interactive-sequence"
      role="region"
      tabIndex={0}
      aria-label={blockTitle.trim() || "Step-by-step activity"}
      onKeyDown={onArrowNav}
    >
      {!hideBlockTitle && blockTitle.trim() ? (
        <h3 className="interactive-sequence__main-title">{blockTitle}</h3>
      ) : null}
      <InteractiveSequenceIntro
        intro={intro}
        className="interactive-sequence__intro"
        markdownClassName="interactive-sequence__intro--md lesson-content lesson-md-body"
      />

      <div
        className={`interactive-sequence__layout${isOnFinalStep ? " interactive-sequence__layout--complete" : ""}`}
      >
        <div className="interactive-sequence__main-column">
        {!hideImagePlaceholder ? (
        <div className="interactive-sequence__media-card">
          <div
            className="interactive-sequence__media-zone interactive-sequence__media-zone--sized"
            data-interactive-sequence-compact-image="compact-v1"
          >
            <div className="interactive-sequence__fade-slot interactive-sequence__fade-slot--media">
              {showImg ? (
                <figure className="interactive-sequence__figure">
                  <LessonImageFrame variant="primary" lightboxSrc={imgResolved}>
                    <img
                      className="interactive-sequence__image"
                      src={imgResolved}
                      alt={step?.title?.trim() || "Step illustration"}
                      onError={hideBrokenLessonImage}
                      onLoad={restoreLockedScroll}
                    />
                  </LessonImageFrame>
                </figure>
              ) : viewMode === "student" ? null : (
                <div className="interactive-sequence__image-placeholder" role="status">
                  <p className="interactive-sequence__image-placeholder-text">
                    Add an image for this step (optional but recommended)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        ) : null}

        <div className="interactive-sequence__body-card">
          <div className="interactive-sequence__detail interactive-sequence__detail--sized">
            <div className="interactive-sequence__fade-slot interactive-sequence__fade-slot--text">
              <p className="interactive-sequence__step-of">
                Step {stepNum} of {total}
              </p>
              {step?.title ? <h4 className="interactive-sequence__step-title">{step.title}</h4> : null}
              <p className="interactive-sequence__explanation-text">{descriptionStudent.trim() || "—"}</p>

              {hasTestMe ? (
                <div
                  className="interactive-sequence__reveal-card interactive-sequence__reveal-card--sized"
                  role="region"
                  aria-labelledby={`${revealBodyId}-label`}
                >
                  <p className="interactive-sequence__reveal-label" id={`${revealBodyId}-label`}>
                    <span aria-hidden>🧠</span> Test me
                  </p>
                  {loadingQuestion ? (
                    <p className="interactive-sequence__test-me-status" role="status">
                      Generating question…
                    </p>
                  ) : questionReady ? (
                    <p className="interactive-sequence__test-question">{displayQuestion}</p>
                  ) : testMeError ? (
                    <p className="interactive-sequence__test-me-error" role="alert">
                      {testMeError}
                    </p>
                  ) : null}
                  {!answerRevealed ? (
                    <button
                      type="button"
                      className="interactive-sequence__reveal-btn"
                      aria-expanded={false}
                      aria-controls={revealBodyId}
                      disabled={loadingQuestion || !questionReady}
                      onMouseDown={preventClickFocusScroll}
                      onClick={() => setAnswerRevealed(true)}
                    >
                      Reveal answer / key idea
                    </button>
                  ) : (
                    <div id={revealBodyId} className="interactive-sequence__reveal-body">
                      <AssessmentFeedback
                        answer={displayAnswer || fallbackAnswer}
                        answerLabel="Answer / Key idea"
                        explanation={displayExplanation || testExplanationTrimmed || undefined}
                        explanationLabel="Explanation"
                      />
                      <button
                        type="button"
                        className="interactive-sequence__reveal-hide-btn"
                        onMouseDown={preventClickFocusScroll}
                        onClick={() => setAnswerRevealed(false)}
                        aria-expanded={true}
                      >
                        Hide
                      </button>
                    </div>
                  )}
                </div>
              ) : anyStepHasTestMe ? (
                <div className="interactive-sequence__reveal-spacer" aria-hidden="true" />
              ) : null}
            </div>
          </div>
          <div className="interactive-sequence__complete-track">
            {isOnFinalStep ? (
              <div className="interactive-sequence__complete" role="status" aria-live="polite">
                <span className="interactive-sequence__complete-badge">✓ Process complete</span>
              </div>
            ) : (
              <div className="interactive-sequence__complete-placeholder" aria-hidden="true" />
            )}
          </div>
        </div>

        <nav className="interactive-sequence__nav" aria-label="Step navigation">
          <button
            type="button"
            className="interactive-sequence__btn interactive-sequence__btn--prev"
            onMouseDown={preventClickFocusScroll}
            onClick={(e) => {
              blurStepControlAfterClick(e);
              go(safeIndex - 1);
            }}
            disabled={safeIndex <= 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="interactive-sequence__btn interactive-sequence__btn--next"
            onMouseDown={preventClickFocusScroll}
            onClick={(e) => {
              blurStepControlAfterClick(e);
              go(safeIndex + 1);
            }}
            disabled={safeIndex >= list.length - 1}
          >
            Next
          </button>
        </nav>
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
                      type="button"
                      className={
                        isActive
                          ? "interactive-sequence__step-button interactive-sequence__step-button--active"
                          : "interactive-sequence__step-button"
                      }
                      onMouseDown={preventClickFocusScroll}
                      onClick={(e) => {
                        blurStepControlAfterClick(e);
                        go(i);
                      }}
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
      </div>
    </div>
  );
}
