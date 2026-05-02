import React from "react";
import "./assessmentFeedback.css";

export type AssessmentFeedbackStatus = "correct" | "incorrect" | undefined;

export type AssessmentFeedbackProps = {
  title?: string;
  answer?: string;
  answerLabel?: string;
  explanation?: string;
  explanationLabel?: string;
  status?: AssessmentFeedbackStatus;
  className?: string;
  variant?: "default" | "v12";
};

export function AssessmentFeedback({
  title,
  answer,
  answerLabel = "Answer",
  explanation,
  explanationLabel = "Explanation",
  status,
  className = "",
  variant = "default",
}: AssessmentFeedbackProps): React.ReactElement | null {
  const answerStr = answer != null ? String(answer).trim() : "";
  const explainStr = explanation != null ? String(explanation).trim() : "";
  const hasAnswer = Boolean(answerStr);
  const hasExplanation = Boolean(explainStr);
  if (!title && !hasAnswer && !hasExplanation) return null;

  const rootClass = [
    "assessment-feedback",
    status === "correct" ? "assessment-feedback--correct" : "",
    status === "incorrect" ? "assessment-feedback--incorrect" : "",
    variant === "v12" ? "assessment-feedback--v12" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {title ? <div className="assessment-feedback__title">{title}</div> : null}
      {hasAnswer ? (
        <div className="assessment-feedback__row">
          <span className="assessment-feedback__label">{answerLabel}:</span>
          <span className="assessment-feedback__value">{answerStr}</span>
        </div>
      ) : null}
      {hasExplanation ? (
        <div className="assessment-feedback__explain-wrap">
          <span className="assessment-feedback__label">{explanationLabel}:</span>
          <div className="assessment-feedback__explain-box">{explainStr}</div>
        </div>
      ) : null}
    </div>
  );
}
