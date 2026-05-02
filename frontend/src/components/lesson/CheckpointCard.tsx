import React, { useMemo, useState } from "react";
import { mergeCheckpointExplanationParts } from "../../utils/checkpointFeedback";
import { AssessmentFeedback } from "./AssessmentFeedback";
import "./lessonRenderer.css";

export type CheckpointCardProps = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  /** Merged with `explanation` for AssessmentFeedback after reveal (same persistence shape as lessons). */
  markScheme?: string[];
};

/**
 * Interactive checkpoint: options + question visible; answer hidden until revealed.
 */
export function CheckpointCard({ question, options, answer, explanation, markScheme }: CheckpointCardProps): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const hasAnswer = Boolean(answer && answer.trim());
  const mergedExplanation = useMemo(
    () => mergeCheckpointExplanationParts({ explanation, markScheme }),
    [explanation, markScheme]
  );

  return (
    <section className="lesson-renderer-checkpoint" aria-label="Checkpoint">
      <div className="lesson-renderer-checkpoint__badge">⚡ CHECKPOINT</div>
      {question.trim() ? (
        <div className="lesson-renderer-checkpoint__question">
          <strong>Question</strong>
          <div className="lesson-renderer-checkpoint__question-body">{question.trim()}</div>
        </div>
      ) : null}
      {options.length > 0 ? (
        <ol className="lesson-renderer-checkpoint__options">
          {options.map((opt, idx) => (
            <li key={idx} className="lesson-renderer-checkpoint__option">
              <span className="lesson-renderer-checkpoint__option-label">Option {idx + 1}</span>
              <div>{opt}</div>
            </li>
          ))}
        </ol>
      ) : null}
      {hasAnswer ? (
        <div className="lesson-renderer-checkpoint__answer-block">
          {revealed ? (
            <AssessmentFeedback
              answer={answer.trim()}
              answerLabel="Answer"
              explanation={mergedExplanation}
              explanationLabel="Explanation"
            />
          ) : null}
          <button
            type="button"
            className="lesson-renderer-checkpoint__reveal-btn"
            onClick={() => setRevealed((r) => !r)}
            aria-expanded={revealed}
          >
            {revealed ? "Hide Answer" : "Reveal Answer"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
