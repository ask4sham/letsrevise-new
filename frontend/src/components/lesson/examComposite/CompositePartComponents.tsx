import React, { useMemo } from "react";
import type { ExamQuestionPart } from "../../../api/examQuestions";
import {
  AnswerFeedbackPanel,
  type AnswerFeedbackStatus,
} from "../AnswerFeedbackPanel";
import { buildMcqFeedback, gradeMcq } from "../../../utils/gradeMcq";
import {
  buildShortAnswerImprovementTip,
  deriveShortAnswerFeedbackStatus,
  gradeShortAnswer,
} from "../../../utils/gradeShortAnswer";
import type { CompositeExamSummary } from "./compositeMarking";
import {
  answerLineCount,
  formatMarksBadge,
  partLabel,
  resolvePartMarkScheme,
} from "./compositeUtils";
import { CompositePartType } from "./types";
import { gradeTablePart, tableHasStudentInput } from "./interactions/table/markTable";

export function formatMcqAnswerLine(grade: ReturnType<typeof gradeMcq> | null): string {
  if (!grade) return "";
  if (grade.selectedLabel && grade.selectedOption) {
    return `${grade.selectedLabel} — ${grade.selectedOption}`;
  }
  return grade.selectedOption || "";
}

function examScoreRibbonLabel(status: AnswerFeedbackStatus): string {
  if (status === "correct") return "Correct";
  if (status === "partial") return "Partially correct";
  return "Incorrect";
}

export function ExamQuestionScoreRibbon({
  status,
  marksAwarded,
  totalMarks,
}: {
  status: AnswerFeedbackStatus;
  marksAwarded: number;
  totalMarks: number;
}) {
  const max = Math.max(1, totalMarks || 1);
  const awarded = Math.max(0, Math.min(marksAwarded ?? 0, max));
  return (
    <div
      className={`exam-question-score-ribbon exam-question-score-ribbon--${status}`}
      data-testid="exam-question-score-ribbon"
    >
      <div className="exam-question-score-ribbon__label">{examScoreRibbonLabel(status)}</div>
      <div className="exam-question-score-ribbon__marks">
        {awarded} / {max} marks
      </div>
    </div>
  );
}

export function CompositeExamResultSummary({ summary }: { summary: CompositeExamSummary }): React.ReactElement {
  return (
    <div className="exam-composite__result-summary" data-testid="exam-composite-result-summary">
      <h4 className="exam-composite__result-summary-title">📝 Exam question result</h4>
      <div className="exam-composite__result-summary-overall">
        <div className="exam-composite__result-summary-overall-label">Overall score</div>
        <div
          className={`exam-composite__result-summary-overall-score exam-composite__result-summary-overall-score--${summary.status}`}
          data-testid="exam-composite-overall-score"
        >
          {summary.marksAwarded} / {summary.totalMarks} marks
        </div>
      </div>
      <div className="exam-composite__result-summary-section exam-composite__result-summary-section--strong">
        <div className="exam-composite__result-summary-heading">Strengths</div>
        <ul className="exam-composite__result-summary-list">
          {summary.strongAreas.length > 0 ? (
            summary.strongAreas.map((line) => <li key={line}>{line}</li>)
          ) : (
            <li className="exam-composite__result-summary-empty">None yet</li>
          )}
        </ul>
      </div>
      <div className="exam-composite__result-summary-section exam-composite__result-summary-section--revise">
        <div className="exam-composite__result-summary-heading">Focus your revision</div>
        <ul className="exam-composite__result-summary-list exam-composite__result-summary-list--revise">
          {summary.needsRevision.length > 0 ? (
            summary.needsRevision.map((line) => <li key={line}>{line}</li>)
          ) : (
            <li className="exam-composite__result-summary-empty">Full marks — well done.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function getCompositeMcqOptionStyle(
  index: number,
  marked: boolean,
  mcqGrade: ReturnType<typeof gradeMcq> | null
): React.CSSProperties | undefined {
  if (!marked || !mcqGrade) return undefined;
  if (index === mcqGrade.correctIndex) {
    return { background: "#dcfce7", outline: "2px solid #22c55e", outlineOffset: 0, borderRadius: 4 };
  }
  if (index === mcqGrade.selectedIndex && mcqGrade.status === "incorrect") {
    return { background: "#fee2e2", outline: "2px solid #ef4444", outlineOffset: 0, borderRadius: 4 };
  }
  return undefined;
}

export function CompositePartMarkingSection({
  part,
  partIndex,
  checked,
  onCheck,
  mcqSelectedIndex,
  writtenAnswer,
}: {
  part: ExamQuestionPart;
  partIndex: number;
  checked: boolean;
  onCheck: () => void;
  mcqSelectedIndex?: number;
  writtenAnswer?: string;
}): React.ReactElement | null {
  const type = String(part.type).toLowerCase();
  const isMcq = type === CompositePartType.MCQ;
  const isTable = type === CompositePartType.TABLE;
  const options = Array.isArray(part.options)
    ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean)
    : [];
  const markScheme = resolvePartMarkScheme(part);
  const hasAnswer = isMcq
    ? mcqSelectedIndex !== undefined
    : isTable
      ? tableHasStudentInput(writtenAnswer)
      : Boolean(String(writtenAnswer ?? "").trim());

  const mcqGrade = useMemo(() => {
    if (!checked || !isMcq || mcqSelectedIndex === undefined) return null;
    const correctIndex = typeof part.correctIndex === "number" ? part.correctIndex : -1;
    if (correctIndex < 0 || options.length === 0) return null;
    return gradeMcq(mcqSelectedIndex, correctIndex, options, part.marks ?? 1);
  }, [checked, isMcq, mcqSelectedIndex, part.correctIndex, part.marks, options]);

  const mcqFeedback = useMemo(() => {
    if (!mcqGrade) return undefined;
    const correctOption = options[mcqGrade.correctIndex] ?? "";
    return buildMcqFeedback({
      grade: mcqGrade,
      options,
      markScheme,
      correctAnswer: correctOption,
    });
  }, [mcqGrade, options, markScheme]);

  const tableGrade = useMemo(() => {
    if (!checked || !isTable) return null;
    return gradeTablePart({
      partData: part.partData,
      studentAnswerJson: writtenAnswer,
      marks: part.marks ?? 1,
    });
  }, [checked, isTable, part.partData, writtenAnswer, part.marks]);

  const shortGrade = useMemo(() => {
    if (!checked || isMcq || isTable) return null;
    return gradeShortAnswer({
      userAnswer: writtenAnswer ?? "",
      markScheme,
      marks: part.marks ?? 1,
    });
  }, [checked, isMcq, isTable, writtenAnswer, markScheme, part.marks]);

  const shortFeedbackStatus = shortGrade
    ? deriveShortAnswerFeedbackStatus(shortGrade.score, shortGrade.maxMarks)
    : "incorrect";

  const shortImprovementTip = useMemo(() => {
    if (!shortGrade) return undefined;
    const missing = (shortGrade.missing || []).map((l) => String(l ?? "").trim()).filter(Boolean);
    if (missing.length > 0) return `Revise: ${missing[0]}`;
    return buildShortAnswerImprovementTip(shortGrade);
  }, [shortGrade]);

  if (!checked) {
    return (
      <div className="exam-composite__part-marking">
        <button
          type="button"
          className="exam-composite__part-check-btn"
          disabled={!hasAnswer}
          onClick={onCheck}
        >
          Check answer
        </button>
      </div>
    );
  }

  if (isMcq) {
    if (!mcqGrade || !mcqFeedback) {
      return (
        <div className="exam-composite__part-marking exam-composite__part-marking--error">
          Could not mark this part — the correct option is missing from the exam data.
        </div>
      );
    }
    return (
      <div className="exam-composite__part-marking" data-testid={`exam-composite-part-marking-${partIndex}`}>
        <AnswerFeedbackPanel
          layout="mcq"
          status={mcqGrade.status}
          marksAwarded={mcqGrade.marksAwarded}
          totalMarks={mcqGrade.totalMarks}
          yourAnswer={formatMcqAnswerLine(mcqGrade)}
          correctAnswer={
            mcqGrade.correctLabel && mcqGrade.correctOption
              ? `${mcqGrade.correctLabel} — ${mcqGrade.correctOption}`
              : options[mcqGrade.correctIndex] ?? ""
          }
          markScheme={markScheme}
          mcqFeedback={mcqFeedback}
          improvementTip={mcqFeedback.improvementTip}
        />
      </div>
    );
  }

  if (isTable) {
    if (!tableGrade) {
      return (
        <div className="exam-composite__part-marking exam-composite__part-marking--error">
          Could not mark this table — check the table data.
        </div>
      );
    }
    return (
      <div className="exam-composite__part-marking" data-testid={`exam-composite-part-marking-${partIndex}`}>
        <AnswerFeedbackPanel
          status={tableGrade.status}
          marksAwarded={tableGrade.marksAwarded}
          totalMarks={tableGrade.maxMarks}
          yourAnswer={tableGrade.yourAnswerLines.join("; ") || "(no answers entered)"}
          correctAnswer={tableGrade.correctAnswerLines.join("; ")}
          markScheme={markScheme}
          improvementTip={
            tableGrade.status === "correct"
              ? undefined
              : `Revise: check the blank cells (${tableGrade.incorrectKeys.length + tableGrade.missingKeys.length} to review).`
          }
        />
      </div>
    );
  }

  if (!shortGrade) return null;

  return (
    <div className="exam-composite__part-marking" data-testid={`exam-composite-part-marking-${partIndex}`}>
      <AnswerFeedbackPanel
        status={shortFeedbackStatus}
        marksAwarded={shortGrade.score}
        totalMarks={shortGrade.maxMarks}
        yourAnswer={String(writtenAnswer ?? "").trim()}
        markScheme={markScheme}
        improvementTip={shortImprovementTip}
        contradictionFeedback={shortGrade.contradictionFeedback}
        markSchemeHits={shortGrade.hits}
        markSchemeMissing={shortGrade.missing}
      />
    </div>
  );
}

export function CompositePartMarks({ marks }: { marks: number | null | undefined }) {
  const badge = formatMarksBadge(marks);
  if (!badge) return null;
  return <span className="exam-composite__marks">{badge}</span>;
}

export function CompositeMcqOptions({
  options,
  partIndex,
  selectedIndex,
  onSelect,
  interactive,
  disabled,
  mcqGrade,
  marked,
}: {
  options: string[];
  partIndex: number;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  interactive: boolean;
  disabled?: boolean;
  mcqGrade?: ReturnType<typeof gradeMcq> | null;
  marked?: boolean;
}) {
  const name = `exam-composite-mcq-${partIndex}`;
  return (
    <ul className="exam-composite__mcq-options" role="list">
      {options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const id = `${name}-opt-${i}`;
        const optionStyle = getCompositeMcqOptionStyle(i, Boolean(marked), mcqGrade ?? null);
        if (interactive) {
          return (
            <li key={i} className="exam-composite__mcq-option">
              <label className="exam-composite__mcq-label" style={optionStyle}>
                <input
                  id={id}
                  type="radio"
                  name={name}
                  className="exam-composite__mcq-radio"
                  checked={selectedIndex === i}
                  disabled={disabled}
                  onChange={() => {
                    if (!disabled) onSelect?.(i);
                  }}
                />
                <span className="exam-composite__mcq-letter" aria-hidden>
                  {letter}
                </span>
                <span className="exam-composite__mcq-text">{opt}</span>
              </label>
            </li>
          );
        }
        return (
          <li key={i} className="exam-composite__mcq-option exam-composite__mcq-option--static">
            <span className="exam-composite__mcq-box" aria-hidden />
            <span className="exam-composite__mcq-letter">{letter}</span>
            <span className="exam-composite__mcq-text">{opt}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function CompositeAnswerLines({
  marks,
  value,
  onChange,
  interactive,
  disabled,
}: {
  marks: number | null | undefined;
  value?: string;
  onChange?: (value: string) => void;
  interactive: boolean;
  disabled?: boolean;
}) {
  const lines = answerLineCount(marks);
  if (!interactive) {
    return (
      <div className="exam-composite__answer-lines exam-composite__answer-lines--static" aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="exam-composite__answer-line" />
        ))}
      </div>
    );
  }
  return (
    <textarea
      className="exam-composite__answer-input"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      rows={lines}
      placeholder=""
      spellCheck
      disabled={disabled}
      aria-label="Your answer"
    />
  );
}

export function CompositePartPrompt({
  part,
  index,
}: {
  part: ExamQuestionPart;
  index: number;
}) {
  const label = partLabel(part, index);
  return (
    <div className="exam-composite__part-prompt">
      <span className="exam-composite__part-label">({label})</span>
      <p className="exam-composite__part-text">{part.questionText}</p>
      <CompositePartMarks marks={part.marks} />
    </div>
  );
}
