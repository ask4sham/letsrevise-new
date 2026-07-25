/**
 * PR-PRACTICE-LOOP-1: One item — MCQ (choices) or non-MCQ (I got it right/wrong).
 * Correctness styling only after server-grounded submission feedback.
 * Layout uses focusedPractice.css (Tailwind utilities are not compiled in this app).
 */
import React from "react";
import type { PracticeSetItem } from "../../api/practiceSets";
import "./focusedPractice.css";

export type PracticeItemFeedback = {
  /** Server-provided; omit / undefined = unknown (legacy). */
  isCorrect?: boolean;
  correctChoiceIndex?: number;
  explanation?: string;
};

export type PracticeItemCardProps = {
  item: PracticeSetItem;
  /** MCQ: selected index; non-MCQ: undefined until user picks */
  selectedChoiceIndex?: number;
  onSelectChoice?: (index: number) => void;
  onMarkSelf?: (isCorrect: boolean) => void;
  submitted?: boolean;
  disabled?: boolean;
  /** Post-submit styling only — never pass before submission. */
  feedback?: PracticeItemFeedback | null;
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
  feedback,
}: PracticeItemCardProps) {
  const isMcq = item.contentType === "quiz_mcq" && Array.isArray(item.choices) && item.choices.length > 0;
  const skill = skillChipLabel(item);
  const timeSec = item.metadata?.estimatedTimeSec;
  const locked = Boolean(disabled || submitted);
  const reveal =
    Boolean(submitted) &&
    feedback != null &&
    typeof feedback.isCorrect === "boolean" &&
    Number.isFinite(feedback.correctChoiceIndex);

  return (
    <div className="fp-panel" data-testid="practice-question-card">
      <div className="fp-meta">
        {skill ? (
          <span data-testid="practice-skill-chip" className="fp-skill">
            {skill}
          </span>
        ) : null}
        {timeSec != null && Number(timeSec) > 0 ? (
          <span className="fp-time" data-testid="practice-time-estimate">
            About {Math.round(Number(timeSec))} seconds
          </span>
        ) : null}
      </div>

      <div className="fp-question" data-testid="practice-question-text">
        {item.prompt}
      </div>

      {isMcq ? (
        <div>
          <p className="fp-choose">Choose one answer</p>
          <div
            className="fp-options"
            role="radiogroup"
            aria-label="Answer choices"
            data-testid="practice-answer-options"
          >
            {item.choices!.map((choice, i) => {
              const selected = selectedChoiceIndex === i;
              const isServerCorrect =
                reveal && Number(feedback!.correctChoiceIndex) === i;
              const isServerWrongSelected =
                reveal && selected && feedback!.isCorrect === false && !isServerCorrect;
              let optionClass = "fp-option";
              if (isServerCorrect) optionClass += " fp-option--correct";
              else if (isServerWrongSelected) optionClass += " fp-option--incorrect";
              else if (selected) optionClass += " fp-option--selected";

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
                  data-correct={isServerCorrect ? "true" : undefined}
                  data-incorrect={isServerWrongSelected ? "true" : undefined}
                  className={optionClass}
                >
                  <span className="fp-option__row">
                    <span className="fp-option__text">{choice}</span>
                    <span aria-hidden="true" className="fp-option__radio">
                      {selected ? <span className="fp-option__radio-dot" /> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="fp-self-mark">
          <span className="fp-choose" style={{ marginBottom: 0 }}>
            How did you do?
          </span>
          <button
            type="button"
            onClick={() => onMarkSelf?.(true)}
            disabled={locked}
            className="fp-btn fp-btn--ok"
          >
            I got it right
          </button>
          <button
            type="button"
            onClick={() => onMarkSelf?.(false)}
            disabled={locked}
            className="fp-btn fp-btn--bad"
          >
            I got it wrong
          </button>
        </div>
      )}
    </div>
  );
}
