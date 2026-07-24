/**
 * PR-PRACTICE-LOOP-1: Runner — show items one by one, submit attempt, Saved ✓, Next, completion.
 * Layout uses focusedPractice.css (Tailwind utilities are not compiled in this app).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { PracticeItemCard } from "./PracticeItemCard";
import type { PracticeSetItem } from "../../api/practiceSets";
import { submitPracticeAttempt } from "../../api/practiceAttempts";
import "./focusedPractice.css";

export type PracticeRunnerProps = {
  items: PracticeSetItem[];
  teacherId: string;
  /** Frozen set id — included on submit for no-link item-level authorisation. */
  practiceSetId?: string | null;
  /** First unanswered index when resuming a partial set (frozen order). */
  initialIndex?: number;
  /** Notify parent for progress UI (0-based). */
  onIndexChange?: (index: number) => void;
  onComplete?: () => void;
  onLinkError?: (message: string) => void;
};

function clampStartIndex(raw: number | undefined, length: number): number {
  if (!length) return 0;
  const n = Number.isFinite(raw) ? Math.floor(Number(raw)) : 0;
  if (n < 0) return 0;
  if (n >= length) return Math.max(0, length - 1);
  return n;
}

export function PracticeRunner({
  items,
  teacherId,
  practiceSetId,
  initialIndex = 0,
  onIndexChange,
  onComplete,
  onLinkError,
}: PracticeRunnerProps) {
  const [index, setIndex] = useState(() => clampStartIndex(initialIndex, items.length));
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcqSelection, setMcqSelection] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const next = clampStartIndex(initialIndex, items.length);
    setIndex(next);
    setSaved(false);
    setError(null);
    setMcqSelection(null);
  }, [initialIndex, items]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const currentItem = index >= 0 && index < items.length ? items[index] : null;
  const isComplete = items.length > 0 && index >= items.length;
  const isLast = index + 1 >= items.length;

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [index]);

  const handleSubmitMcq = useCallback(
    async (selectedChoiceIndex: number) => {
      if (!currentItem || currentItem.contentType !== "quiz_mcq") return;
      setSubmitting(true);
      setError(null);
      const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
      try {
        await submitPracticeAttempt({
          teacherId,
          practiceSetId: practiceSetId || undefined,
          specKey: currentItem.topicKey.split(":")[0] || "",
          topicKey: currentItem.topicKey,
          contentType: "quiz_mcq",
          contentId: currentItem.contentId,
          selectedChoiceIndex,
          timeSpentSec,
        });
        setSaved(true);
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
    [currentItem, teacherId, practiceSetId, onLinkError]
  );

  const handleSubmitSelfMark = useCallback(
    async (isCorrect: boolean) => {
      if (!currentItem) return;
      setSubmitting(true);
      setError(null);
      const timeSpentSec = Math.round((Date.now() - startTimeRef.current) / 1000);
      try {
        await submitPracticeAttempt({
          teacherId,
          practiceSetId: practiceSetId || undefined,
          specKey: currentItem.topicKey.split(":")[0] || "",
          topicKey: currentItem.topicKey,
          contentType: currentItem.contentType,
          contentId: currentItem.contentId,
          isCorrect,
          timeSpentSec,
        });
        setSaved(true);
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
    [currentItem, teacherId, practiceSetId, onLinkError]
  );

  const goNext = useCallback(() => {
    setSaved(false);
    setMcqSelection(null);
    if (index + 1 < items.length) {
      setIndex((i) => i + 1);
    } else {
      onComplete?.();
    }
  }, [index, items.length, onComplete]);

  const resetAnswer = useCallback(() => {
    if (saved || submitting) return;
    setMcqSelection(null);
    setError(null);
  }, [saved, submitting]);

  if (items.length === 0) return null;

  if (isComplete) {
    return (
      <div className="fp-complete" data-testid="practice-complete-card">
        <h2>Practice complete</h2>
        <p>
          You completed {items.length} question{items.length === 1 ? "" : "s"}.
        </p>
      </div>
    );
  }

  const isMcq =
    currentItem?.contentType === "quiz_mcq" &&
    Array.isArray(currentItem.choices) &&
    currentItem.choices.length > 0;

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
        submitted={saved}
        disabled={submitting}
      />

      {isMcq && !saved ? (
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

      {saved ? (
        <div className="fp-saved" data-testid="practice-saved-panel">
          <p className="fp-saved__title">Answer saved</p>
          <p className="fp-saved__body">
            Your attempt has been recorded. Continue when you are ready.
          </p>
          <button
            type="button"
            onClick={goNext}
            data-testid="practice-next"
            className="fp-btn fp-btn--primary"
          >
            {isLast ? "Finish practice" : "Next question"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
