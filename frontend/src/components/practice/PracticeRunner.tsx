/**
 * PR-PRACTICE-LOOP-1: Runner — submit attempt, server-grounded feedback, completion score.
 * Layout uses focusedPractice.css (Tailwind utilities are not compiled in this app).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PracticeItemCard, type PracticeItemFeedback } from "./PracticeItemCard";
import type { PracticePriorOutcome, PracticeSetItem } from "../../api/practiceSets";
import {
  submitPracticeAttempt,
  type SubmitPracticeAttemptResponse,
} from "../../api/practiceAttempts";
import {
  allItemsAttempted,
  buildPriorOutcomeMap,
  firstUnansweredIndex,
  practiceItemKey,
} from "../../utils/practicePriorOutcomes";
import "./focusedPractice.css";

export type PracticeItemResult = {
  contentType: string;
  contentId: string;
  attempted: boolean;
  isCorrect?: boolean;
};

export type PracticeRunnerProps = {
  items: PracticeSetItem[];
  teacherId: string;
  /** Frozen set id — included on submit for no-link item-level authorisation. */
  practiceSetId?: string | null;
  /** First unanswered index when resuming a partial set (frozen order). */
  initialIndex?: number;
  /** Server prior state for resume / completed-set hydration. */
  priorOutcomes?: PracticePriorOutcome[];
  /** Notify parent for progress UI (0-based). */
  onIndexChange?: (index: number) => void;
  /** Fired once when the completion screen is shown (not an auto-redirect). */
  onResultsReady?: (score: {
    correctCount: number;
    total: number;
    scoreAvailable: boolean;
    attemptedCount: number;
  }) => void;
  /** Legacy dashboard/exam runners — fired when results are shown (do not use for auto-redirect on focused practice). */
  onComplete?: () => void;
  onReturnToLesson?: () => void;
  /** When true, show Try another set on the completion screen. */
  tryAnotherSetAvailable?: boolean;
  onTryAnotherSet?: () => void;
  tryAnotherSetBusy?: boolean;
  onLinkError?: (message: string) => void;
};

function clampStartIndex(raw: number | undefined, length: number): number {
  if (!length) return 0;
  const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : 0;
  if (n < 0) return 0;
  if (n >= length) return Math.max(0, length - 1);
  return n;
}

function scoreCopy(correctCount: number, total: number): string {
  if (total <= 0) return "Keep practising — revisit the lesson and try the topic again later.";
  if (correctCount === total) {
    return "Excellent — you answered every question correctly.";
  }
  const ratio = correctCount / total;
  if (ratio >= 0.6) {
    return "Good work — review the questions you found difficult.";
  }
  return "Keep practising — revisit the lesson and try the topic again later.";
}

function feedbackFromResponse(
  res: SubmitPracticeAttemptResponse | null | undefined
): PracticeItemFeedback | null {
  if (!res || res.ok !== true) return null;
  const feedback: PracticeItemFeedback = {};
  if (typeof res.isCorrect === "boolean") feedback.isCorrect = res.isCorrect;
  if (typeof res.correctChoiceIndex === "number" && Number.isFinite(res.correctChoiceIndex)) {
    feedback.correctChoiceIndex = res.correctChoiceIndex;
  }
  const explanation =
    (typeof res.explanation === "string" && res.explanation.trim()) ||
    (typeof res.feedback === "string" && res.feedback.trim()) ||
    "";
  if (explanation) feedback.explanation = explanation;
  return feedback;
}

function mapFromPriors(
  priorOutcomes: PracticePriorOutcome[] | undefined
): Record<string, PracticeItemResult> {
  const built = buildPriorOutcomeMap(priorOutcomes);
  const map: Record<string, PracticeItemResult> = {};
  for (const [key, row] of Object.entries(built)) {
    map[key] = {
      contentType: row.contentType,
      contentId: String(row.contentId),
      attempted: true,
      ...(typeof row.isCorrect === "boolean" ? { isCorrect: row.isCorrect } : {}),
    };
  }
  return map;
}

function resolveStartState(
  items: PracticeSetItem[],
  priorOutcomes: PracticePriorOutcome[] | undefined,
  initialIndex: number
) {
  const fromPriors = firstUnansweredIndex(items, priorOutcomes);
  const complete = allItemsAttempted(items, priorOutcomes);
  if (complete) {
    return { index: 0, showResults: true };
  }
  // Prefer server-derived first unanswered over a stale URL startIndex=0.
  if ((priorOutcomes || []).length > 0) {
    return { index: clampStartIndex(fromPriors, items.length), showResults: false };
  }
  return { index: clampStartIndex(initialIndex, items.length), showResults: false };
}

export function PracticeRunner({
  items,
  teacherId,
  practiceSetId,
  initialIndex = 0,
  priorOutcomes,
  onIndexChange,
  onResultsReady,
  onComplete,
  onReturnToLesson,
  tryAnotherSetAvailable = false,
  onTryAnotherSet,
  tryAnotherSetBusy = false,
  onLinkError,
}: PracticeRunnerProps) {
  const start = resolveStartState(items, priorOutcomes, initialIndex);
  const [index, setIndex] = useState(start.index);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<PracticeItemFeedback | null>(null);
  const [showResults, setShowResults] = useState(start.showResults);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcqSelection, setMcqSelection] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const resultsReadyFiredRef = useRef(false);

  const [outcomes, setOutcomes] = useState<Record<string, PracticeItemResult>>(() =>
    mapFromPriors(priorOutcomes)
  );

  useEffect(() => {
    const next = resolveStartState(items, priorOutcomes, initialIndex);
    setIndex(next.index);
    setShowResults(next.showResults);
    setSubmitted(false);
    setFeedback(null);
    setError(null);
    setMcqSelection(null);
    resultsReadyFiredRef.current = false;
    setOutcomes(mapFromPriors(priorOutcomes));
  }, [initialIndex, items, priorOutcomes]);

  useEffect(() => {
    if (!showResults) onIndexChange?.(index);
  }, [index, onIndexChange, showResults]);

  const currentItem = index >= 0 && index < items.length ? items[index] : null;
  const isLast = index + 1 >= items.length;

  const score = useMemo(() => {
    const total = items.length;
    let correctCount = 0;
    let knownCount = 0;
    let attemptedCount = 0;
    for (const it of items) {
      const row = outcomes[practiceItemKey(it.contentType, it.contentId)];
      if (row?.attempted) attemptedCount += 1;
      if (typeof row?.isCorrect === "boolean") {
        knownCount += 1;
        if (row.isCorrect) correctCount += 1;
      }
    }
    const scoreAvailable = total > 0 && knownCount === total;
    return { correctCount, total, scoreAvailable, attemptedCount, knownCount };
  }, [items, outcomes]);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [index]);

  useEffect(() => {
    if (!showResults || resultsReadyFiredRef.current) return;
    resultsReadyFiredRef.current = true;
    onResultsReady?.({
      correctCount: score.correctCount,
      total: score.total,
      scoreAvailable: score.scoreAvailable,
      attemptedCount: score.attemptedCount,
    });
    onComplete?.();
  }, [showResults, score, onResultsReady, onComplete]);

  const recordOutcome = useCallback(
    (item: PracticeSetItem, res: SubmitPracticeAttemptResponse) => {
      const key = practiceItemKey(item.contentType, item.contentId);
      setOutcomes((prev) => ({
        ...prev,
        [key]: {
          contentType: item.contentType,
          contentId: item.contentId,
          attempted: true,
          ...(typeof res.isCorrect === "boolean" ? { isCorrect: res.isCorrect } : {}),
        },
      }));
    },
    []
  );

  const handleSubmitMcq = useCallback(
    async (selectedChoiceIndex: number) => {
      if (!currentItem || currentItem.contentType !== "quiz_mcq") return;
      setSubmitting(true);
      setError(null);
      const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
      try {
        const res = await submitPracticeAttempt({
          teacherId,
          practiceSetId: practiceSetId || undefined,
          specKey: currentItem.topicKey.split(":")[0] || "",
          topicKey: currentItem.topicKey,
          contentType: "quiz_mcq",
          contentId: currentItem.contentId,
          selectedChoiceIndex,
          timeSpentSec,
        });
        recordOutcome(currentItem, res);
        setFeedback(feedbackFromResponse(res));
        setSubmitted(true);
      } catch (e: unknown) {
        const err = e as { message?: string; status?: number; data?: { error?: string } };
        const msg = err?.data?.error ?? err?.message ?? "Failed to save";
        setError(msg);
        if (err?.status === 403 && (msg.includes("link") || msg.includes("teacher"))) {
          onLinkError?.(msg);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [currentItem, teacherId, practiceSetId, onLinkError, recordOutcome]
  );

  const handleSubmitSelfMark = useCallback(
    async (isCorrect: boolean) => {
      if (!currentItem) return;
      setSubmitting(true);
      setError(null);
      const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
      try {
        const res = await submitPracticeAttempt({
          teacherId,
          practiceSetId: practiceSetId || undefined,
          specKey: currentItem.topicKey.split(":")[0] || "",
          topicKey: currentItem.topicKey,
          contentType: currentItem.contentType,
          contentId: currentItem.contentId,
          isCorrect,
          timeSpentSec,
        });
        recordOutcome(currentItem, res);
        setFeedback(feedbackFromResponse(res));
        setSubmitted(true);
      } catch (e: unknown) {
        const err = e as { message?: string; status?: number; data?: { error?: string } };
        const msg = err?.data?.error ?? err?.message ?? "Failed to save";
        setError(msg);
        if (err?.status === 403 && (msg.includes("link") || msg.includes("teacher"))) {
          onLinkError?.(msg);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [currentItem, teacherId, practiceSetId, onLinkError, recordOutcome]
  );

  const goNext = useCallback(() => {
    setSubmitted(false);
    setFeedback(null);
    setMcqSelection(null);
    setError(null);
    if (index + 1 < items.length) {
      setIndex((i) => i + 1);
    } else {
      setShowResults(true);
    }
  }, [index, items.length]);

  const resetAnswer = useCallback(() => {
    if (submitted || submitting) return;
    setMcqSelection(null);
    setError(null);
  }, [submitted, submitting]);

  if (items.length === 0) return null;

  if (showResults) {
    const { correctCount, total, scoreAvailable } = score;
    return (
      <div className="fp-complete" data-testid="practice-complete-card">
        <p className="fp-complete__eyebrow">Practice complete</p>
        <h2>You completed {total} question{total === 1 ? "" : "s"}.</h2>
        {scoreAvailable ? (
          <>
            <p className="fp-complete__score-label">Score</p>
            <p className="fp-complete__score" data-testid="practice-complete-score">
              {correctCount} / {total}
            </p>
            <p className="fp-complete__copy" data-testid="practice-complete-copy">
              {scoreCopy(correctCount, total)}
            </p>
          </>
        ) : (
          <p className="fp-complete__copy" data-testid="practice-complete-copy">
            All {total} questions completed. A score is unavailable for some earlier answers.
          </p>
        )}
        <div className="fp-complete__actions">
          <button
            type="button"
            className="fp-btn fp-btn--primary"
            data-testid="practice-return-to-lesson"
            onClick={() => onReturnToLesson?.()}
          >
            Return to lesson
          </button>
          {tryAnotherSetAvailable ? (
            <button
              type="button"
              className="fp-btn fp-btn--secondary"
              data-testid="practice-try-another-set"
              disabled={tryAnotherSetBusy}
              onClick={() => onTryAnotherSet?.()}
            >
              {tryAnotherSetBusy ? "Preparing questions…" : "Try another set"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const isMcq =
    currentItem?.contentType === "quiz_mcq" &&
    Array.isArray(currentItem.choices) &&
    currentItem.choices.length > 0;

  const knownCorrect = typeof feedback?.isCorrect === "boolean";
  const feedbackTone =
    knownCorrect && feedback!.isCorrect === true
      ? "correct"
      : knownCorrect && feedback!.isCorrect === false
        ? "incorrect"
        : "saved";

  return (
    <div data-testid="practice-runner">
      <p className="fp-visually-hidden" data-testid="practice-runner-progress">
        Question {index + 1} of {items.length}
      </p>

      <PracticeItemCard
        item={currentItem!}
        selectedChoiceIndex={mcqSelection ?? undefined}
        onSelectChoice={setMcqSelection}
        onMarkSelf={handleSubmitSelfMark}
        submitted={submitted}
        disabled={submitting}
        feedback={submitted ? feedback : null}
      />

      {isMcq && !submitted ? (
        <div className="fp-actions">
          <button
            type="button"
            onClick={() => mcqSelection !== null && handleSubmitMcq(mcqSelection)}
            disabled={submitting || mcqSelection === null}
            data-testid="practice-check-answer"
            className="fp-btn fp-btn--primary"
          >
            {submitting ? "Saving…" : "Check answer"}
          </button>
          <button
            type="button"
            onClick={resetAnswer}
            disabled={submitting || mcqSelection === null}
            data-testid="practice-reset-answer"
            className="fp-btn fp-btn--secondary"
          >
            Reset answer
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="fp-error" role="alert">
          {error}
        </p>
      ) : null}

      {submitted ? (
        <div
          className={`fp-feedback fp-feedback--${feedbackTone}`}
          data-testid="practice-feedback-panel"
          data-tone={feedbackTone}
        >
          <p className="fp-feedback__title" data-testid="practice-feedback-title">
            {feedbackTone === "correct"
              ? "Correct"
              : feedbackTone === "incorrect"
                ? "Not quite"
                : "Answer saved"}
          </p>
          {feedback?.explanation ? (
            <p className="fp-feedback__body" data-testid="practice-feedback-explanation">
              {feedback.explanation}
            </p>
          ) : feedbackTone === "saved" ? (
            <p className="fp-feedback__body">
              Your attempt has been recorded. Continue when you are ready.
            </p>
          ) : null}
          <button
            type="button"
            onClick={goNext}
            data-testid="practice-next"
            className="fp-btn fp-btn--primary"
          >
            {isLast ? "View results" : "Next question"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
