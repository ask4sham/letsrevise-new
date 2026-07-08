import React, { useMemo, useState } from "react";
import type { ExamQuestion, ExamQuestionPart } from "../../../api/examQuestions";
import type { ExamQuestionBlockMode } from "../ExamQuestionBlock";
import { ZoomableImageTrigger } from "../ZoomableImageLightbox";
import { deriveShortAnswerFeedbackStatus } from "../../../utils/gradeShortAnswer";
import { gradeMcq } from "../../../utils/gradeMcq";
import {
  buildCompositeExamSummary,
  gradeCompositePartResult,
} from "./compositeMarking";
import {
  CompositeExamResultSummary,
  ExamQuestionScoreRibbon,
} from "./CompositePartComponents";
import { CompositePartRouter } from "./CompositePartRouter";
import { inlineExamQuestionImageSrc, partLabel } from "./compositeUtils";
import { resolveCompositeSchemaVersion } from "./schemaVersion";
import { CompositePartType } from "./types";
import { listBlankCells, parseTablePartData } from "./interactions/table/tableTypes";

export type CompositeExamShellProps = {
  question: ExamQuestion;
  mode: ExamQuestionBlockMode;
  presentation: "default" | "v12";
  boxStyle: React.CSSProperties;
};

export function CompositeExamShell({
  question,
  mode,
  boxStyle,
}: CompositeExamShellProps): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [mcqSelections, setMcqSelections] = useState<Record<number, number>>({});
  const [checkedParts, setCheckedParts] = useState<Record<number, boolean>>({});

  // Read schema version for V2 readiness; V1 questions omit the field.
  void resolveCompositeSchemaVersion(question);

  const isClassroom = mode === "classroom";
  const isEditor = mode === "editor";
  const isStudent = mode === "student";
  const mcqInteractive = true;
  const writtenInteractive = !isClassroom;

  const parts: ExamQuestionPart[] = Array.isArray(question.parts) ? question.parts : [];
  const totalMarks =
    typeof question.totalMarks === "number"
      ? question.totalMarks
      : parts.reduce((sum, p) => sum + (Number.isFinite(Number(p.marks)) ? Number(p.marks) : 0), 0);

  const getPartMcqGrade = (part: ExamQuestionPart, partIndex: number): ReturnType<typeof gradeMcq> | null => {
    if (!checkedParts[partIndex]) return null;
    const isMcq = String(part.type).toLowerCase() === "mcq";
    if (!isMcq) return null;
    const options = Array.isArray(part.options)
      ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
    const selectedIndex = mcqSelections[partIndex];
    if (selectedIndex === undefined) return null;
    const correctIndex = typeof part.correctIndex === "number" ? part.correctIndex : -1;
    if (correctIndex < 0 || options.length === 0) return null;
    return gradeMcq(selectedIndex, correctIndex, options, part.marks ?? 1);
  };

  const totalScore = useMemo(() => {
    let awarded = 0;
    let anyChecked = false;
    for (let idx = 0; idx < parts.length; idx += 1) {
      if (!checkedParts[idx]) continue;
      anyChecked = true;
      const result = gradeCompositePartResult(parts[idx], mcqSelections[idx], answers[idx]);
      if (result) awarded += result.marksAwarded;
    }
    if (!anyChecked) return null;
    return {
      marksAwarded: awarded,
      totalMarks,
      status: deriveShortAnswerFeedbackStatus(awarded, totalMarks),
    };
  }, [checkedParts, parts, mcqSelections, answers, totalMarks]);

  const examSummary = useMemo(
    () => buildCompositeExamSummary(parts, checkedParts, mcqSelections, answers, totalMarks),
    [parts, checkedParts, mcqSelections, answers, totalMarks]
  );

  const markPartChecked = (partIndex: number) => {
    setCheckedParts((prev) => ({ ...prev, [partIndex]: true }));
  };

  const sharedStem =
    (question.sharedStem && String(question.sharedStem).trim()) ||
    (question.question && String(question.question).trim()) ||
    "";
  const imageUrl = question.imageUrl && String(question.imageUrl).trim() ? String(question.imageUrl).trim() : "";
  const metaBits = [question.subject, question.examBoard, question.level, question.topic]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  const firstPart = parts[0];
  const restParts = parts.slice(1);

  return (
    <div
      style={boxStyle}
      className={`exam-question-block exam-question-block--composite exam-composite${isClassroom ? " exam-composite--classroom" : ""}`}
    >
      <header className="exam-composite__header">
        <div className="exam-composite__header-row">
          <h3 className="exam-composite__title">Exam question</h3>
          <span className="exam-composite__total-marks">
            {totalMarks} {totalMarks === 1 ? "mark" : "marks"}
          </span>
        </div>
        {metaBits.length > 0 && <p className="exam-composite__meta">{metaBits.join(" · ")}</p>}
        {question.status === "draft" && isEditor && (
          <span className="exam-composite__draft-badge">Draft</span>
        )}
      </header>

      <div className={`exam-composite__context${imageUrl ? " exam-composite__context--with-image" : ""}`}>
        {imageUrl && (
          <div className="exam-composite__image-col">
            <div className="exam-composite__image-panel">
              <ZoomableImageTrigger
                src={inlineExamQuestionImageSrc(imageUrl)}
                alt="Question diagram"
                imageClassName="exam-composite__image"
              />
            </div>
          </div>
        )}

        <div className="exam-composite__stem-col">
          {sharedStem && <p className="exam-composite__stem">{sharedStem}</p>}

          {firstPart ? (
            <CompositePartRouter
              part={firstPart}
              partIndex={0}
              sectionClassName="exam-composite__part exam-composite__part--inline"
              showAnswerSpace={writtenInteractive}
              mcqInteractive={mcqInteractive}
              answerValue={answers[0]}
              onAnswerChange={(v) => setAnswers((prev) => ({ ...prev, 0: v }))}
              mcqSelectedIndex={mcqSelections[0]}
              onMcqSelect={(i) => setMcqSelections((prev) => ({ ...prev, 0: i }))}
              inputDisabled={isStudent && Boolean(checkedParts[0])}
              partChecked={Boolean(checkedParts[0])}
              partMcqGrade={getPartMcqGrade(firstPart, 0)}
              enableMarking={isStudent}
              onPartCheck={() => markPartChecked(0)}
            />
          ) : null}
        </div>
      </div>

      {restParts.length > 0 && (
        <div className="exam-composite__written-parts">
          {restParts.map((part, i) => {
            const idx = i + 1;
            return (
              <CompositePartRouter
                key={idx}
                part={part}
                partIndex={idx}
                showAnswerSpace={writtenInteractive}
                mcqInteractive={mcqInteractive}
                answerValue={answers[idx]}
                onAnswerChange={(v) => setAnswers((prev) => ({ ...prev, [idx]: v }))}
                mcqSelectedIndex={mcqSelections[idx]}
                onMcqSelect={(selected) => setMcqSelections((prev) => ({ ...prev, [idx]: selected }))}
                inputDisabled={Boolean(isStudent && checkedParts[idx])}
                partChecked={Boolean(checkedParts[idx])}
                partMcqGrade={getPartMcqGrade(part, idx)}
                enableMarking={isStudent}
                onPartCheck={() => markPartChecked(idx)}
              />
            );
          })}
        </div>
      )}

      <footer className="exam-composite__footer">
        {isStudent && examSummary ? (
          <CompositeExamResultSummary summary={examSummary} />
        ) : isStudent && totalScore ? (
          <div className="exam-composite__total-score" data-testid="exam-composite-total-score">
            <div className="exam-composite__total-score-label">Total score</div>
            <ExamQuestionScoreRibbon
              status={totalScore.status}
              marksAwarded={totalScore.marksAwarded}
              totalMarks={totalScore.totalMarks}
            />
          </div>
        ) : null}
        <button
          type="button"
          className="exam-composite__reveal-btn"
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? "Hide answers / mark scheme" : "Reveal answers / mark scheme"}
        </button>

        {revealed && (
          <div className="exam-composite__reveal">
            {parts.map((part, idx) => {
              const label = partLabel(part, idx);
              const options = Array.isArray(part.options)
                ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean)
                : [];
              const partType = String(part.type).toLowerCase();
              const isMcqPart = partType === CompositePartType.MCQ && options.length > 0;
              const isTablePart = partType === CompositePartType.TABLE;
              const correctIdx = typeof part.correctIndex === "number" ? part.correctIndex : -1;
              const correctOption =
                isMcqPart && correctIdx >= 0 && options[correctIdx] != null ? options[correctIdx] : "";
              const markScheme = Array.isArray(part.markScheme)
                ? part.markScheme.map((l) => String(l ?? "").trim()).filter(Boolean)
                : [];
              const tableData = isTablePart ? parseTablePartData(part.partData) : null;
              const tableBlanks = tableData ? listBlankCells(tableData) : [];

              return (
                <div key={idx} className="exam-composite__reveal-part">
                  <div className="exam-composite__reveal-part-label">({label})</div>
                  {isMcqPart && correctOption ? (
                    <p className="exam-composite__reveal-answer">
                      Correct answer: <strong>{String.fromCharCode(65 + correctIdx)}</strong> — {correctOption}
                    </p>
                  ) : null}
                  {isTablePart && tableBlanks.length > 0 ? (
                    <div className="exam-composite__reveal-scheme">
                      <span className="exam-composite__reveal-scheme-label">Correct cell answers:</span>
                      <ul className="exam-composite__reveal-list">
                        {tableBlanks.map((blank) => (
                          <li key={`${blank.row}-${blank.col}`}>
                            Row {blank.row + 1}, column {blank.col + 1}: {blank.correctAnswer}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {markScheme.length > 0 ? (
                    <div className="exam-composite__reveal-scheme">
                      {!isMcqPart && <span className="exam-composite__reveal-scheme-label">Mark scheme:</span>}
                      <ul className="exam-composite__reveal-list">
                        {markScheme.map((line, lineIdx) => (
                          <li key={lineIdx}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    !isMcqPart && !isTablePart && (
                      <p className="exam-composite__reveal-empty">No mark scheme provided.</p>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </footer>
    </div>
  );
}
