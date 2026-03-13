/**
 * PR-PRACTICE-LOOP-1: One item — MCQ (choices) or non-MCQ (I got it right/wrong).
 * Does not show correct answer or mark scheme.
 */
import React from "react";
import type { PracticeSetItem } from "../../api/practiceSets";

export type PracticeItemCardProps = {
  item: PracticeSetItem;
  /** MCQ: selected index; non-MCQ: undefined until user picks */
  selectedChoiceIndex?: number;
  onSelectChoice?: (index: number) => void;
  onMarkSelf?: (isCorrect: boolean) => void;
  submitted?: boolean;
  disabled?: boolean;
};

export function PracticeItemCard({
  item,
  selectedChoiceIndex,
  onSelectChoice,
  onMarkSelf,
  submitted,
  disabled,
}: PracticeItemCardProps) {
  const isMcq = item.contentType === "quiz_mcq" && Array.isArray(item.choices) && item.choices.length > 0;

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="prose max-w-none mb-4 whitespace-pre-wrap">{item.prompt}</div>
      {item.metadata?.estimatedTimeSec != null && (
        <p className="text-xs text-gray-500 mb-2">~{item.metadata.estimatedTimeSec}s</p>
      )}

      {isMcq ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Choose one:</p>
          <div className="flex flex-col gap-2">
            {item.choices!.map((choice, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelectChoice?.(i)}
                disabled={disabled || submitted}
                className={`text-left px-4 py-3 border rounded-lg transition ${
                  selectedChoiceIndex === i
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                } disabled:opacity-70`}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">How did you do?</span>
          <button
            type="button"
            onClick={() => onMarkSelf?.(true)}
            disabled={disabled || submitted}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            I got it right
          </button>
          <button
            type="button"
            onClick={() => onMarkSelf?.(false)}
            disabled={disabled || submitted}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            I got it wrong
          </button>
        </div>
      )}
    </div>
  );
}
