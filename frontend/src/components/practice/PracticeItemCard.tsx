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

function skillChipLabel(item: PracticeSetItem): string | null {
  if (item.metadata?.badge) {
    const b = String(item.metadata.badge).trim();
    if (b) return b.toUpperCase();
  }
  const skill = String(item.metadata?.skill || "").toLowerCase();
  if (skill === "analysis") return "ANALYSE";
  if (skill === "exam-technique") return "EVALUATE";
  if (skill === "application") return "APPLY";
  if (skill === "recall") return "RECALL";
  if (item.metadata?.challenge) return "CHALLENGE";
  return null;
}

export function PracticeItemCard({
  item,
  selectedChoiceIndex,
  onSelectChoice,
  onMarkSelf,
  submitted,
  disabled,
}: PracticeItemCardProps) {
  const isMcq = item.contentType === "quiz_mcq" && Array.isArray(item.choices) && item.choices.length > 0;
  const skill = skillChipLabel(item);
  const timeSec = item.metadata?.estimatedTimeSec;
  const locked = Boolean(disabled || submitted);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm"
      data-testid="practice-question-card"
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {skill ? (
          <span
            data-testid="practice-skill-chip"
            className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold tracking-wide text-indigo-800"
          >
            {skill}
          </span>
        ) : null}
        {timeSec != null && Number(timeSec) > 0 ? (
          <span className="text-sm text-slate-500" data-testid="practice-time-estimate">
            About {Math.round(Number(timeSec))} seconds
          </span>
        ) : null}
      </div>

      <div
        className="text-[1.05rem] sm:text-xl font-semibold text-slate-900 leading-snug whitespace-pre-wrap mb-5"
        data-testid="practice-question-text"
      >
        {item.prompt}
      </div>

      {isMcq ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-600">Choose one answer</p>
          <div
            className="flex flex-col gap-3"
            role="radiogroup"
            aria-label="Answer choices"
            data-testid="practice-answer-options"
          >
            {item.choices!.map((choice, i) => {
              const selected = selectedChoiceIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelectChoice?.(i)}
                  disabled={locked}
                  data-testid={`practice-answer-option-${i}`}
                  data-selected={selected ? "true" : "false"}
                  className={`group w-full text-left rounded-xl border-2 px-4 py-3.5 sm:px-5 sm:py-4 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    selected
                      ? "border-indigo-600 bg-indigo-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:opacity-80`}
                >
                  <span className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected
                          ? "border-indigo-600 bg-indigo-600"
                          : "border-slate-300 bg-white group-hover:border-indigo-400"
                      }`}
                    >
                      {selected ? (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 text-[0.95rem] sm:text-base leading-relaxed text-slate-800 break-words">
                      {choice}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
          <span className="text-sm font-medium text-slate-600">How did you do?</span>
          <button
            type="button"
            onClick={() => onMarkSelf?.(true)}
            disabled={locked}
            className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            I got it right
          </button>
          <button
            type="button"
            onClick={() => onMarkSelf?.(false)}
            disabled={locked}
            className="px-4 py-3 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            I got it wrong
          </button>
        </div>
      )}
    </div>
  );
}
