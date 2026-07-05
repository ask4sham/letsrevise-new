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

function statusIcon(status: AnswerFeedbackStatus): string {
  if (status === "correct") return "✅";
  if (status === "partial") return "🟡";
  return "❌";
}

function statusTitle(status: AnswerFeedbackStatus): string {
  if (status === "correct") return "Correct";
  if (status === "partial") return "Partially correct";
  return "Incorrect";
}

function FeedbackHero({
  status,
  awarded,
  max,
}: {
  status: AnswerFeedbackStatus;
  awarded: number;
  max: number;
}): React.ReactElement {
  return (
    <div className="answer-feedback-panel__hero" data-testid="answer-feedback-hero">
      <div className="answer-feedback-panel__hero-status">
        <span aria-hidden>{statusIcon(status)}</span>
        <span>{statusTitle(status)}</span>
      </div>
      <div
        className={`answer-feedback-panel__score-badge answer-feedback-panel__score-badge--${status}`}
        data-testid="answer-feedback-score-badge"
      >
        {awarded} / {max} marks
      </div>
    </div>
  );
}

function InlineAnswerLine({
  prefix,
  value,
  valueTone,
  testId,
}: {
  prefix: string;
  value: string;
  valueTone: "correct" | "incorrect";
  testId?: string;
}): React.ReactElement {
  return (
    <p className="answer-feedback-panel__inline-answer" data-testid={testId}>
      <span className={`answer-feedback-panel__inline-prefix answer-feedback-panel__inline-prefix--${valueTone}`}>
        {prefix}
      </span>{" "}
      <span className={`answer-feedback-panel__inline-value answer-feedback-panel__value-text--${valueTone}`}>
        {value}
      </span>
    </p>
  );
}

function FeedbackSection({
  variant,
  heading,
  body,
  testId,
  uppercase = true,
}: {
  variant: "correct" | "wrong" | "memory" | "tip" | "neutral";
  heading: string;
  body: React.ReactNode;
  testId?: string;
  uppercase?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`answer-feedback-panel__section answer-feedback-panel__section--${variant}`}
      data-testid={testId}
    >
      <div
        className="answer-feedback-panel__section-heading"
        style={uppercase ? undefined : { textTransform: "none" }}
      >
        {heading}
      </div>
      <div className="answer-feedback-panel__body">{body}</div>
    </div>
  );
}

function McqWrongOptionList({ items }: { items: McqOptionExplanation[] }) {
  if (!items.length) return null;
  return (
    <FeedbackSection
      variant="neutral"
      heading="Why other options are wrong"
      uppercase={false}
      body={
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
      }
    />
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
      <FeedbackHero status={status} awarded={awarded} max={max} />

      {contradictionFeedback ? (
        <div className="answer-feedback-panel__alert" data-testid="answer-feedback-contradiction">
          {contradictionFeedback}
        </div>
      ) : null}

      {isMcqLayout ? (
        <>
          {yours ? (
            <InlineAnswerLine
              prefix={status === "correct" ? "✅ Your answer:" : "❌ Your answer:"}
              value={yours}
              valueTone={status === "correct" ? "correct" : "incorrect"}
              testId="answer-feedback-your-answer"
            />
          ) : null}

          {status === "incorrect" && correct ? (
            <InlineAnswerLine
              prefix="✅ Correct answer:"
              value={correct}
              valueTone="correct"
              testId="answer-feedback-correct-answer"
            />
          ) : null}

          {status === "correct" && mcqFeedback?.whyCorrect ? (
            <FeedbackSection
              variant="correct"
              heading="Why this is correct"
              body={mcqFeedback.whyCorrect}
              testId="answer-feedback-why-correct"
            />
          ) : null}

          {status === "incorrect" && mcqFeedback?.whySelectedWrong ? (
            <FeedbackSection
              variant="wrong"
              heading="Why your answer is wrong"
              body={mcqFeedback.whySelectedWrong}
              testId="answer-feedback-why-wrong"
            />
          ) : null}

          {status === "incorrect" && mcqFeedback?.memoryRule ? (
            <FeedbackSection
              variant="memory"
              heading="🧠 Memory rule"
              body={mcqFeedback.memoryRule}
              testId="answer-feedback-memory-rule"
              uppercase={false}
            />
          ) : null}

          {status === "incorrect" && tip ? (
            <FeedbackSection
              variant="tip"
              heading="📘 Revise this concept"
              body={tip}
              testId="answer-feedback-tip"
              uppercase={false}
            />
          ) : null}
        </>
      ) : (
        <>
          {yours ? (
            <InlineAnswerLine
              prefix={status === "correct" ? "✅ Your answer:" : "❌ Your answer:"}
              value={yours}
              valueTone={status === "correct" ? "correct" : "incorrect"}
              testId="answer-feedback-your-answer"
            />
          ) : null}

          {correct && !(status === "correct" && yours) ? (
            <InlineAnswerLine
              prefix="✅ Correct answer:"
              value={correct}
              valueTone="correct"
              testId={status === "incorrect" ? "answer-feedback-correct-answer" : undefined}
            />
          ) : null}

          {mcqFeedback?.whyCorrect ? (
            <FeedbackSection
              variant="correct"
              heading="Why this is correct"
              body={mcqFeedback.whyCorrect}
              testId="answer-feedback-why-correct"
            />
          ) : null}

          {mcqFeedback?.whySelectedWrong ? (
            <FeedbackSection
              variant="wrong"
              heading="Why your answer is wrong"
              body={mcqFeedback.whySelectedWrong}
              testId="answer-feedback-why-wrong"
            />
          ) : null}

          {status === "incorrect" && mcqFeedback?.memoryRule ? (
            <FeedbackSection
              variant="memory"
              heading="🧠 Memory rule"
              body={mcqFeedback.memoryRule}
              testId="answer-feedback-memory-rule"
              uppercase={false}
            />
          ) : null}

          <McqWrongOptionList items={mcqFeedback?.wrongOptionExplanations ?? []} />
        </>
      )}

      {!isMcqLayout && model ? (
        <FeedbackSection variant="neutral" heading="Model answer" body={model} uppercase={false} />
      ) : null}

      {!isMcqLayout && hits.length > 0 ? (
        <FeedbackSection
          variant="correct"
          heading="Mark scheme points matched"
          uppercase={false}
          body={
            <ul className="answer-feedback-panel__list">
              {hits.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          }
        />
      ) : null}

      {!isMcqLayout && missing.length > 0 ? (
        <FeedbackSection
          variant="wrong"
          heading="Still needed for full marks"
          uppercase={false}
          body={
            <ul className="answer-feedback-panel__list">
              {missing.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          }
        />
      ) : null}

      {!isMcqLayout && schemeLines.length > 0 && hits.length === 0 && missing.length === 0 ? (
        <FeedbackSection
          variant="neutral"
          heading="Mark scheme"
          uppercase={false}
          body={
            <ul className="answer-feedback-panel__list">
              {schemeLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          }
        />
      ) : null}

      {!isMcqLayout && tip ? (
        <FeedbackSection
          variant="tip"
          heading="📘 Revise this concept"
          body={tip}
          testId="answer-feedback-tip"
          uppercase={false}
        />
      ) : null}
    </div>
  );
}
