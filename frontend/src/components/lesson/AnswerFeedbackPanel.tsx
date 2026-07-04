import React from "react";
import type { McqFeedback, McqOptionExplanation } from "../../utils/gradeMcq";
import "./answerFeedbackPanel.css";

export type AnswerFeedbackStatus = "correct" | "incorrect" | "partial";

export type AnswerFeedbackPanelProps = {
  status: AnswerFeedbackStatus;
  marksAwarded: number;
  totalMarks: number;
  correctAnswer?: string;
  /** Selected option text for structured MCQ feedback (e.g. "B — Mitochondria"). */
  yourAnswer?: string;
  /** Structured MCQ layout with ✅/❌ answer lines and revision target. */
  layout?: "default" | "mcq";
  markScheme?: string[];
  modelAnswer?: string;
  improvementTip?: string;
  mcqFeedback?: McqFeedback;
  contradictionFeedback?: string;
  markSchemeHits?: string[];
  markSchemeMissing?: string[];
  variant?: "default" | "v12";
  className?: string;
};

function statusHeadline(status: AnswerFeedbackStatus, layout: "default" | "mcq"): string {
  if (status === "correct") return layout === "mcq" ? "✅ Correct" : "Correct";
  if (status === "partial") return "Partially correct";
  return layout === "mcq" ? "❌ Incorrect" : "Incorrect";
}

function McqWrongOptionList({ items }: { items: McqOptionExplanation[] }) {
  if (!items.length) return null;
  return (
    <div className="answer-feedback-panel__section">
      <div className="answer-feedback-panel__label">Why other options are wrong</div>
      <ul className="answer-feedback-panel__list">
        {items.map((item) => (
          <li key={item.label}>
            <strong>
              {item.label} — {item.option}
            </strong>
            : {item.explanation}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnswerFeedbackPanel({
  status,
  marksAwarded,
  totalMarks,
  correctAnswer,
  yourAnswer,
  layout = "default",
  markScheme,
  modelAnswer,
  improvementTip,
  mcqFeedback,
  contradictionFeedback,
  markSchemeHits,
  markSchemeMissing,
  variant = "default",
  className = "",
}: AnswerFeedbackPanelProps): React.ReactElement {
  const max = Math.max(1, totalMarks || 1);
  const awarded = Math.max(0, Math.min(marksAwarded ?? 0, max));
  const schemeLines = (markScheme || []).map((l) => String(l ?? "").trim()).filter(Boolean);
  const hits = (markSchemeHits || []).map((l) => String(l ?? "").trim()).filter(Boolean);
  const missing = (markSchemeMissing || []).map((l) => String(l ?? "").trim()).filter(Boolean);
  const correct = String(correctAnswer ?? "").trim();
  const yours = String(yourAnswer ?? "").trim();
  const model = String(modelAnswer ?? "").trim();
  const tip = String(improvementTip ?? mcqFeedback?.improvementTip ?? "").trim();
  const isMcqLayout = layout === "mcq";

  const rootClass = [
    "answer-feedback-panel",
    `answer-feedback-panel--${status}`,
    variant === "v12" ? "answer-feedback-panel--v12" : "",
    isMcqLayout ? "answer-feedback-panel--mcq-layout" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} data-testid="answer-feedback-panel" data-status={status}>
      <div className="answer-feedback-panel__headline">
        {statusHeadline(status, layout)} — {awarded}/{max}
      </div>

      {contradictionFeedback ? (
        <div className="answer-feedback-panel__alert" data-testid="answer-feedback-contradiction">
          {contradictionFeedback}
        </div>
      ) : null}

      {isMcqLayout ? (
        <>
          {yours ? (
            <div
              className={`answer-feedback-panel__answer-line answer-feedback-panel__answer-line--yours answer-feedback-panel__answer-line--${status}`}
              data-testid="answer-feedback-your-answer"
            >
              <span className="answer-feedback-panel__label">
                {status === "correct" ? "✅ Your answer" : "❌ Your answer"}
              </span>
              <span
                className={`answer-feedback-panel__value answer-feedback-panel__value-text answer-feedback-panel__value-text--${
                  status === "correct" ? "correct" : "incorrect"
                }`}
              >
                {yours}
              </span>
            </div>
          ) : null}

          {status === "incorrect" && correct ? (
            <div
              className="answer-feedback-panel__answer-line answer-feedback-panel__answer-line--correct"
              data-testid="answer-feedback-correct-answer"
            >
              <span className="answer-feedback-panel__label">✅ Correct answer</span>
              <span className="answer-feedback-panel__value answer-feedback-panel__value-text answer-feedback-panel__value-text--correct">
                {correct}
              </span>
            </div>
          ) : null}

          {status === "correct" && mcqFeedback?.whyCorrect ? (
            <div className="answer-feedback-panel__section" data-testid="answer-feedback-why-correct">
              <div className="answer-feedback-panel__label">🎉 Why this is correct</div>
              <div className="answer-feedback-panel__body">{mcqFeedback.whyCorrect}</div>
            </div>
          ) : null}

          {status === "incorrect" && mcqFeedback?.whySelectedWrong ? (
            <div className="answer-feedback-panel__section" data-testid="answer-feedback-why-wrong">
              <div className="answer-feedback-panel__label">🔍 Why your answer is wrong</div>
              <div className="answer-feedback-panel__body">{mcqFeedback.whySelectedWrong}</div>
            </div>
          ) : null}

          {status === "incorrect" && mcqFeedback?.memoryRule ? (
            <div className="answer-feedback-panel__memory-rule" data-testid="answer-feedback-memory-rule">
              <span className="answer-feedback-panel__label">🧠 Memory rule</span>
              <span className="answer-feedback-panel__body">{mcqFeedback.memoryRule}</span>
            </div>
          ) : null}

          {status === "incorrect" && tip ? (
            <div className="answer-feedback-panel__tip" data-testid="answer-feedback-tip">
              <span className="answer-feedback-panel__label">📘 Revise this concept</span>
              <span className="answer-feedback-panel__body">{tip}</span>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {yours ? (
            <div
              className={`answer-feedback-panel__answer-line answer-feedback-panel__answer-line--yours answer-feedback-panel__answer-line--${status}`}
              data-testid="answer-feedback-your-answer"
            >
              <span className="answer-feedback-panel__label">
                {status === "correct" ? "✅ Your answer" : "❌ Your answer"}
              </span>
              <span
                className={`answer-feedback-panel__value answer-feedback-panel__value-text answer-feedback-panel__value-text--${
                  status === "correct" ? "correct" : "incorrect"
                }`}
              >
                {yours}
              </span>
            </div>
          ) : null}

          {correct && !(status === "correct" && yours) ? (
            <div
              className="answer-feedback-panel__answer-line answer-feedback-panel__answer-line--correct"
              data-testid={status === "incorrect" ? "answer-feedback-correct-answer" : undefined}
            >
              <span className="answer-feedback-panel__label">✅ Correct answer</span>
              <span className="answer-feedback-panel__value answer-feedback-panel__value-text answer-feedback-panel__value-text--correct">
                {correct}
              </span>
            </div>
          ) : null}

          {mcqFeedback?.whyCorrect ? (
            <div className="answer-feedback-panel__section" data-testid="answer-feedback-why-correct">
              <div className="answer-feedback-panel__label">🎉 Why this is correct</div>
              <div className="answer-feedback-panel__body">{mcqFeedback.whyCorrect}</div>
            </div>
          ) : null}

          {mcqFeedback?.whySelectedWrong ? (
            <div className="answer-feedback-panel__section" data-testid="answer-feedback-why-wrong">
              <div className="answer-feedback-panel__label">🔍 Why your answer is wrong</div>
              <div className="answer-feedback-panel__body">{mcqFeedback.whySelectedWrong}</div>
            </div>
          ) : null}

          {status === "incorrect" && mcqFeedback?.memoryRule ? (
            <div className="answer-feedback-panel__memory-rule" data-testid="answer-feedback-memory-rule">
              <span className="answer-feedback-panel__label">🧠 Memory rule</span>
              <span className="answer-feedback-panel__body">{mcqFeedback.memoryRule}</span>
            </div>
          ) : null}

          <McqWrongOptionList items={mcqFeedback?.wrongOptionExplanations ?? []} />
        </>
      )}

      {!isMcqLayout && model ? (
        <div className="answer-feedback-panel__section">
          <div className="answer-feedback-panel__label">Model answer</div>
          <div className="answer-feedback-panel__body">{model}</div>
        </div>
      ) : null}

      {!isMcqLayout && hits.length > 0 ? (
        <div className="answer-feedback-panel__section">
          <div className="answer-feedback-panel__label">Mark scheme points matched</div>
          <ul className="answer-feedback-panel__list">
            {hits.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isMcqLayout && missing.length > 0 ? (
        <div className="answer-feedback-panel__section">
          <div className="answer-feedback-panel__label">Still needed for full marks</div>
          <ul className="answer-feedback-panel__list">
            {missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isMcqLayout && schemeLines.length > 0 && hits.length === 0 && missing.length === 0 ? (
        <div className="answer-feedback-panel__section">
          <div className="answer-feedback-panel__label">Mark scheme</div>
          <ul className="answer-feedback-panel__list">
            {schemeLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isMcqLayout && tip ? (
        <div className="answer-feedback-panel__tip" data-testid="answer-feedback-tip">
          <span className="answer-feedback-panel__label">📘 Revise this concept</span>
          <span className="answer-feedback-panel__body">{tip}</span>
        </div>
      ) : null}
    </div>
  );
}
