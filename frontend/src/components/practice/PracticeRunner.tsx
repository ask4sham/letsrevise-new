/**
 * PR-PRACTICE-LOOP-1: Runner — show items one by one, submit attempt, Saved ✓, Next, completion.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { PracticeItemCard } from "./PracticeItemCard";
import type { PracticeSetItem } from "../../api/practiceSets";
import { submitPracticeAttempt } from "../../api/practiceAttempts";

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
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8"
        data-testid="practice-complete-card"
      >
        <h2 className="text-xl font-bold text-emerald-900 mb-2">Practice complete</h2>
        <p className="text-emerald-800">
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
    <div className="space-y-4" data-testid="practice-runner">
      {/* Screen-reader + test-friendly progress echo (visual progress lives in page header). */}
      <p className="sr-only" data-testid="practice-runner-progress">
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
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => mcqSelection !== null && handleSubmitMcq(mcqSelection)}
            disabled={submitting || mcqSelection === null}
            data-testid="practice-check-answer"
            className="inline-flex justify-center items-center px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving…" : "Check answer"}
          </button>
          <button
            type="button"
            onClick={resetAnswer}
            disabled={submitting || mcqSelection === null}
            data-testid="practice-reset-answer"
            className="inline-flex justify-center items-center px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Reset answer
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}

      {saved ? (
        <div
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:px-5"
          data-testid="practice-saved-panel"
        >
          <p className="text-emerald-900 font-semibold mb-3">Answer saved</p>
          <p className="text-sm text-emerald-800 mb-4">
            Your attempt has been recorded. Continue when you are ready.
          </p>
          <button
            type="button"
            onClick={goNext}
            data-testid="practice-next"
            className="inline-flex justify-center items-center px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            {isLast ? "Finish practice" : "Next question"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
