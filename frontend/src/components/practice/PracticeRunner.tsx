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
  onComplete?: () => void;
  onLinkError?: (message: string) => void;
};

export function PracticeRunner({
  items,
  teacherId,
  practiceSetId,
  onComplete,
  onLinkError,
}: PracticeRunnerProps) {
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcqSelection, setMcqSelection] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const currentItem = index >= 0 && index < items.length ? items[index] : null;
  const isComplete = items.length > 0 && index >= items.length;

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

  if (items.length === 0) return null;

  if (isComplete) {
    return (
      <div className="border rounded-lg p-6 bg-green-50">
        <h2 className="text-lg font-semibold mb-2">Practice complete</h2>
        <p className="text-gray-700">You’ve answered all {items.length} questions. Attempts have been saved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
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
      {currentItem?.contentType === "quiz_mcq" && (
        <button
          type="button"
          onClick={() => mcqSelection !== null && handleSubmitMcq(mcqSelection)}
          disabled={submitting || mcqSelection === null}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Submit answer"}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && (
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-medium">Saved ✓</span>
          <button
            type="button"
            onClick={goNext}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
