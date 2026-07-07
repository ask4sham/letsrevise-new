import React, { useMemo, useState } from "react";
import type { ExamQuestion, ExamQuestionPart } from "../../api/examQuestions";
import { InlineSelfCheckBlock } from "./InlineSelfCheckBlock";
import { ZoomableImageTrigger } from "./ZoomableImageLightbox";
import {
  AnswerFeedbackPanel,
  type AnswerFeedbackStatus,
} from "./AnswerFeedbackPanel";
import { buildMcqFeedback, gradeMcq } from "../../utils/gradeMcq";
import {
  buildShortAnswerImprovementTip,
  deriveShortAnswerFeedbackStatus,
  gradeShortAnswer,
} from "../../utils/gradeShortAnswer";
import { makeAbsoluteAssetUrl, resolveExamQuestionImageSrc } from "../../utils/assetUrl";
import "./ExamQuestionBlock.css";
import "./answerFeedbackPanel.css";

export type ExamQuestionBlockMode = "editor" | "student" | "classroom";

export type ExamQuestionBlockProps = {
  question: ExamQuestion | null | undefined;
  loading?: boolean;
  missing?: boolean;
  mode?: ExamQuestionBlockMode;
  presentation?: "default" | "v12";
};

function resolveMcqCorrectAnswer(q: ExamQuestion): string {
  if (typeof q.correctAnswer === "string" && q.correctAnswer.trim()) return q.correctAnswer.trim();
  const opts = Array.isArray(q.options) ? q.options : [];
  const idx = typeof q.correctIndex === "number" ? q.correctIndex : -1;
  if (idx >= 0 && opts[idx] != null) return String(opts[idx]).trim();
  return "";
}

function resolveMarkSchemeLines(q: ExamQuestion): string[] {
  if (!Array.isArray(q.markScheme)) return [];
  return q.markScheme.map((line) => String(line ?? "").trim()).filter(Boolean);
}

function resolveModelAnswer(q: ExamQuestion): string {
  const meta = q.metadata;
  if (meta && typeof meta.modelAnswer === "string" && meta.modelAnswer.trim()) {
    return meta.modelAnswer.trim();
  }
  if (typeof q.correctAnswer === "string" && q.type !== "mcq") return q.correctAnswer.trim();
  return "";
}

function mcqOptionIndex(options: string[], value: string | null | undefined): number {
  if (value == null) return -1;
  const sel = String(value).trim();
  if (!sel) return -1;
  const idx = options.findIndex((o) => String(o ?? "").trim() === sel);
  return idx >= 0 ? idx : -1;
}

function examScoreRibbonLabel(status: AnswerFeedbackStatus): string {
  if (status === "correct") return "Correct";
  if (status === "partial") return "Partially correct";
  return "Incorrect";
}

function ExamQuestionScoreRibbon({
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

function formatMcqAnswerLine(grade: ReturnType<typeof gradeMcq> | null): string {
  if (!grade) return "";
  if (grade.selectedLabel && grade.selectedOption) {
    return `${grade.selectedLabel} — ${grade.selectedOption}`;
  }
  return grade.selectedOption || "";
}

function getExamMcqOptionStyle(index: number, checked: boolean, mcqGrade: ReturnType<typeof gradeMcq> | null) {
  const baseBorder = "2px solid rgba(0,0,0,0.14)";
  if (!checked || !mcqGrade) {
    return { background: "white", border: baseBorder, icon: null as string | null };
  }
  if (index === mcqGrade.correctIndex) {
    return { background: "#dcfce7", border: "2px solid #22c55e", icon: "✅" };
  }
  if (index === mcqGrade.selectedIndex && mcqGrade.status === "incorrect") {
    return { background: "#fee2e2", border: "2px solid #ef4444", icon: "❌" };
  }
  return { background: "white", border: baseBorder, icon: null as string | null };
}

function SingleExamMcqStudentBlock({
  question,
  options,
  markSchemeLines,
  modelAnswer,
  metaBits,
  imageUrl,
  boxStyle,
}: {
  question: ExamQuestion;
  options: string[];
  markSchemeLines: string[];
  modelAnswer: string;
  metaBits: string[];
  imageUrl: string;
  boxStyle: React.CSSProperties;
}): React.ReactElement {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hasImage = Boolean(imageUrl);
  const correctAnswer = resolveMcqCorrectAnswer(question);
  const totalMarks = Math.max(1, question.marks ?? 1);
  const correctIndex = useMemo(() => {
    if (typeof question.correctIndex === "number" && question.correctIndex >= 0) {
      return question.correctIndex;
    }
    return mcqOptionIndex(options, correctAnswer);
  }, [question.correctIndex, options, correctAnswer]);
  const selectedIndex = useMemo(
    () => (checked ? mcqOptionIndex(options, selected) : -1),
    [checked, options, selected]
  );
  const mcqGrade = useMemo(() => {
    if (!checked || selectedIndex < 0 || correctIndex < 0) return null;
    return gradeMcq(selectedIndex, correctIndex, options, totalMarks);
  }, [checked, selectedIndex, correctIndex, options, totalMarks]);
  const mcqFeedback = useMemo(() => {
    if (!mcqGrade) return undefined;
    return buildMcqFeedback({
      grade: mcqGrade,
      options,
      markScheme: markSchemeLines,
      explanation: modelAnswer || undefined,
      correctAnswer,
    });
  }, [mcqGrade, options, markSchemeLines, modelAnswer, correctAnswer]);
  const name = `exam-mcq-${question._id}`;

  const promptBlock = (
    <div
      style={{
        color: "#1f2937",
        marginBottom: 12,
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {question.question}
    </div>
  );

  const optionsBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt, i) => {
        const optionStyle = getExamMcqOptionStyle(i, checked, mcqGrade);
        return (
          <div
            key={i}
            className="lr-mcq-option"
            role="button"
            tabIndex={0}
            style={{
              background: optionStyle.background,
              border: optionStyle.border,
              cursor: checked ? "default" : "pointer",
            }}
            onClick={() => {
              if (!checked) setSelected(String(opt ?? "").trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!checked) setSelected(String(opt ?? "").trim());
              }
            }}
          >
            <div className="lr-mcq-text" style={{ color: "#374151", display: "flex", alignItems: "center", gap: 8 }}>
              {optionStyle.icon ? (
                <span aria-hidden style={{ fontSize: "1.1rem", flexShrink: 0 }}>
                  {optionStyle.icon}
                </span>
              ) : null}
              <span>{opt}</span>
            </div>
            <div className="lr-mcq-radio">
              <input
                type="radio"
                name={name}
                value={String(opt ?? "")}
                checked={selected !== null && String(selected).trim() === String(opt ?? "").trim()}
                onChange={() => {
                  if (!checked) setSelected(String(opt ?? "").trim());
                }}
                disabled={checked}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  const checkAndFeedback = (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {!checked ? (
        <button
          type="button"
          disabled={selected === null}
          onClick={() => setChecked(true)}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "2px solid rgba(59,130,246,0.4)",
            background: selected !== null ? "rgba(59,130,246,0.12)" : "#f1f5f9",
            cursor: selected !== null ? "pointer" : "not-allowed",
            fontWeight: 700,
            alignSelf: "flex-start",
          }}
        >
          Check answer
        </button>
      ) : mcqGrade && mcqFeedback ? (
        <AnswerFeedbackPanel
            layout="mcq"
            status={mcqGrade.status}
            marksAwarded={mcqGrade.marksAwarded}
            totalMarks={mcqGrade.totalMarks}
            yourAnswer={formatMcqAnswerLine(mcqGrade)}
            correctAnswer={
              mcqGrade.correctLabel && mcqGrade.correctOption
                ? `${mcqGrade.correctLabel} — ${mcqGrade.correctOption}`
                : correctAnswer
            }
            markScheme={markSchemeLines}
            mcqFeedback={mcqFeedback}
            improvementTip={mcqFeedback.improvementTip}
          />
      ) : (
        <div style={{ color: "#374151", fontSize: 14 }}>
          Could not mark this question — the correct option is missing from the exam data.
        </div>
      )}
    </div>
  );

  const revealButton = (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #7c3aed",
          background: revealed ? "#f5f3ff" : "white",
          color: "#5b21b6",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {revealed ? "Hide answer / mark scheme" : "Reveal answer / mark scheme"}
      </button>
    </div>
  );

  const revealedPanel = revealed ? (
    <div
      className="exam-question-block__reveal"
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        fontSize: 14,
        color: "#1f2937",
      }}
    >
      {markSchemeLines.length > 0 && (
        <ul style={{ margin: "0 0 12px 0", paddingLeft: 20 }}>
          {markSchemeLines.map((line, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {correctAnswer ? (
        <div>
          <strong style={{ display: "block", marginBottom: 6 }}>Correct answer</strong>
          <div>{correctAnswer}</div>
        </div>
      ) : null}
      {modelAnswer ? (
        <div style={{ marginTop: correctAnswer ? 12 : 0 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>Model answer</strong>
          <div style={{ whiteSpace: "pre-wrap" }}>{modelAnswer}</div>
        </div>
      ) : null}
    </div>
  ) : null;

  const header = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: "#374151" }}>Exam question</span>
        {question.marks != null && (
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            ({question.marks} {question.marks === 1 ? "mark" : "marks"})
          </span>
        )}
      </div>
      {metaBits.length > 0 && (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: hasImage ? 12 : 10 }}>{metaBits.join(" · ")}</div>
      )}
    </>
  );

  if (!hasImage) {
    return (
      <div style={boxStyle} className="exam-question-block">
        {header}
        {promptBlock}
        {optionsBlock}
        {checkAndFeedback}
        {revealButton}
        {revealedPanel}
      </div>
    );
  }

  return (
    <div style={boxStyle} className="exam-question-block exam-question-block--with-image">
      {header}
      <div className="exam-question-block__split">
        <ExamQuestionImagePanel imageUrl={imageUrl} />
        <div className="exam-question-block__content">
          {promptBlock}
          {optionsBlock}
        </div>
      </div>
      <div className="exam-question-block__below-split">
        {checkAndFeedback}
        {revealButton}
        {revealedPanel}
      </div>
    </div>
  );
}

/** Stored exam `imageUrl` → inline src (original PNG when a `.display.png` sibling exists). */
function inlineExamQuestionImageSrc(storedUrl: string): string {
  const trimmed = storedUrl.trim();
  if (!trimmed) return "";
  const absolute = makeAbsoluteAssetUrl(trimmed) ?? trimmed;
  return resolveExamQuestionImageSrc(absolute);
}

function ExamQuestionImagePanel({ imageUrl }: { imageUrl: string }) {
  const src = inlineExamQuestionImageSrc(imageUrl);
  return (
    <div className="exam-question-block__image-panel">
      <ZoomableImageTrigger
        src={src}
        alt="Question diagram"
        imageClassName="exam-question-block__image"
      />
    </div>
  );
}

function isCompositeQuestion(q: ExamQuestion): boolean {
  return (
    (String(q.questionMode ?? "").toLowerCase() === "composite" ||
      String(q.type ?? "").toLowerCase() === "composite") &&
    Array.isArray(q.parts) &&
    q.parts.length > 0
  );
}

function partLabel(part: ExamQuestionPart, index: number): string {
  return part.label ? String(part.label).trim() : String.fromCharCode(97 + index);
}

/** Exam-paper answer space: lines scale with mark demand. */
function answerLineCount(marks: number | null | undefined): number {
  const m = Number(marks);
  if (!Number.isFinite(m) || m < 1) return 2;
  if (m === 1) return 1;
  if (m === 2) return 3;
  if (m === 3) return 4;
  if (m === 4) return 5;
  if (m >= 6) return Math.max(6, m);
  return m + 1;
}

function formatMarksBadge(marks: number | null | undefined): string {
  if (marks == null || !Number.isFinite(Number(marks))) return "";
  return `[${marks}]`;
}

function resolvePartMarkScheme(part: ExamQuestionPart): string[] {
  if (!Array.isArray(part.markScheme)) return [];
  return part.markScheme.map((line) => String(line ?? "").trim()).filter(Boolean);
}

function uniqueSummaryLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

type CompositeExamSummary = {
  marksAwarded: number;
  totalMarks: number;
  status: AnswerFeedbackStatus;
  strongAreas: string[];
  needsRevision: string[];
};

function buildCompositeExamSummary(
  parts: ExamQuestionPart[],
  checkedParts: Record<number, boolean>,
  mcqSelections: Record<number, number>,
  answers: Record<number, string>,
  totalMarks: number
): CompositeExamSummary | null {
  if (parts.length === 0) return null;
  if (!parts.every((_, idx) => checkedParts[idx])) return null;

  const strongAreas: string[] = [];
  const needsRevision: string[] = [];
  let marksAwarded = 0;

  for (let idx = 0; idx < parts.length; idx += 1) {
    const part = parts[idx];
    const label = partLabel(part, idx);
    const isMcq = String(part.type).toLowerCase() === "mcq";
    const markScheme = resolvePartMarkScheme(part);
    const options = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];

    if (isMcq) {
      const selectedIndex = mcqSelections[idx];
      if (selectedIndex === undefined) continue;
      const correctIndex = typeof part.correctIndex === "number" ? part.correctIndex : -1;
      if (correctIndex < 0 || options.length === 0) continue;
      const grade = gradeMcq(selectedIndex, correctIndex, options, part.marks ?? 1);
      marksAwarded += grade.marksAwarded;
      const feedback = buildMcqFeedback({
        grade,
        options,
        markScheme,
        correctAnswer: options[correctIndex] ?? "",
      });

      if (grade.status === "correct") {
        strongAreas.push(
          feedback?.whyCorrect?.trim() ||
            `Correctly answered part (${label}): ${grade.correctOption || options[correctIndex] || ""}`.trim()
        );
      } else {
        const reviseLine =
          feedback?.improvementTip?.replace(/^Revise:\s*/i, "").trim() ||
          feedback?.whySelectedWrong?.trim() ||
          feedback?.memoryRule?.trim() ||
          `Review part (${label}) — correct answer: ${grade.correctOption || options[correctIndex] || ""}`.trim();
        needsRevision.push(reviseLine);
      }
      continue;
    }

    const grade = gradeShortAnswer({
      userAnswer: answers[idx] ?? "",
      markScheme,
      marks: part.marks ?? 1,
    });
    marksAwarded += grade.score;
    for (const hit of grade.hits || []) {
      strongAreas.push(String(hit ?? "").trim());
    }
    for (const missing of grade.missing || []) {
      needsRevision.push(String(missing ?? "").trim());
    }
    if (grade.score <= 0 && (!grade.missing || grade.missing.length === 0)) {
      needsRevision.push(`Part (${label}): add more detail to score marks.`);
    }
  }

  return {
    marksAwarded,
    totalMarks,
    status: deriveShortAnswerFeedbackStatus(marksAwarded, totalMarks),
    strongAreas: uniqueSummaryLines(strongAreas),
    needsRevision: uniqueSummaryLines(needsRevision),
  };
}

function CompositeExamResultSummary({ summary }: { summary: CompositeExamSummary }): React.ReactElement {
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

function gradeCompositePartResult(
  part: ExamQuestionPart,
  mcqSelectedIndex: number | undefined,
  writtenAnswer: string | undefined
): { marksAwarded: number; maxMarks: number; status: AnswerFeedbackStatus } | null {
  const isMcq = String(part.type).toLowerCase() === "mcq";
  const options = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
  const markScheme = resolvePartMarkScheme(part);
  const maxMarks = Math.max(1, part.marks ?? 1);

  if (isMcq) {
    if (mcqSelectedIndex === undefined) return null;
    const correctIndex = typeof part.correctIndex === "number" ? part.correctIndex : -1;
    if (correctIndex < 0 || options.length === 0) return null;
    const grade = gradeMcq(mcqSelectedIndex, correctIndex, options, maxMarks);
    return { marksAwarded: grade.marksAwarded, maxMarks: grade.totalMarks, status: grade.status };
  }

  const answer = String(writtenAnswer ?? "").trim();
  if (!answer) return null;
  const grade = gradeShortAnswer({ userAnswer: answer, markScheme, marks: maxMarks });
  return {
    marksAwarded: grade.score,
    maxMarks: grade.maxMarks,
    status: deriveShortAnswerFeedbackStatus(grade.score, grade.maxMarks),
  };
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

function CompositePartMarkingSection({
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
  const isMcq = String(part.type).toLowerCase() === "mcq";
  const options = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
  const markScheme = resolvePartMarkScheme(part);
  const hasAnswer = isMcq ? mcqSelectedIndex !== undefined : Boolean(String(writtenAnswer ?? "").trim());

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

  const shortGrade = useMemo(() => {
    if (!checked || isMcq) return null;
    return gradeShortAnswer({
      userAnswer: writtenAnswer ?? "",
      markScheme,
      marks: part.marks ?? 1,
    });
  }, [checked, isMcq, writtenAnswer, markScheme, part.marks]);

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

function CompositePartMarks({ marks }: { marks: number | null | undefined }) {
  const badge = formatMarksBadge(marks);
  if (!badge) return null;
  return <span className="exam-composite__marks">{badge}</span>;
}

function CompositeMcqOptions({
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
              {/* Input is nested inside the label, so the label is already the
                  control's caption. Do NOT also set htmlFor -> that double-fires
                  the click when the radio itself is clicked, cancelling selection. */}
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

function CompositeAnswerLines({
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

function CompositeWrittenPart({
  part,
  index,
  showAnswerSpace,
  mcqInteractive,
  answerValue,
  onAnswerChange,
  mcqSelectedIndex,
  onMcqSelect,
  enableMarking,
  partChecked,
  onPartCheck,
  partMcqGrade,
}: {
  part: ExamQuestionPart;
  index: number;
  showAnswerSpace: boolean;
  mcqInteractive: boolean;
  answerValue?: string;
  onAnswerChange?: (value: string) => void;
  mcqSelectedIndex?: number;
  onMcqSelect?: (index: number) => void;
  enableMarking?: boolean;
  partChecked?: boolean;
  onPartCheck?: () => void;
  partMcqGrade?: ReturnType<typeof gradeMcq> | null;
}) {
  const label = partLabel(part, index);
  const isMcq = String(part.type).toLowerCase() === "mcq";
  const options = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
  const partCheckedSafe = Boolean(partChecked);
  const inputDisabled = Boolean(enableMarking && partCheckedSafe);

  return (
    <section className="exam-composite__part exam-composite__part--written">
      <div className="exam-composite__part-prompt">
        <span className="exam-composite__part-label">({label})</span>
        <p className="exam-composite__part-text">{part.questionText}</p>
        <CompositePartMarks marks={part.marks} />
      </div>
      {isMcq && options.length > 0 ? (
        <CompositeMcqOptions
          options={options}
          partIndex={index}
          interactive={mcqInteractive}
          selectedIndex={mcqSelectedIndex}
          onSelect={onMcqSelect}
          disabled={inputDisabled}
          marked={partCheckedSafe}
          mcqGrade={partMcqGrade}
        />
      ) : showAnswerSpace ? (
        <CompositeAnswerLines
          marks={part.marks}
          value={answerValue}
          onChange={onAnswerChange}
          interactive
          disabled={inputDisabled}
        />
      ) : (
        <CompositeAnswerLines marks={part.marks} interactive={false} />
      )}
      {enableMarking && onPartCheck ? (
        <CompositePartMarkingSection
          part={part}
          partIndex={index}
          checked={partCheckedSafe}
          onCheck={onPartCheck}
          mcqSelectedIndex={mcqSelectedIndex}
          writtenAnswer={answerValue}
        />
      ) : null}
    </section>
  );
}

function CompositeExamQuestion({
  question,
  mode,
  boxStyle,
}: {
  question: ExamQuestion;
  mode: ExamQuestionBlockMode;
  presentation: "default" | "v12";
  boxStyle: React.CSSProperties;
}): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [mcqSelections, setMcqSelections] = useState<Record<number, number>>({});
  const [checkedParts, setCheckedParts] = useState<Record<number, boolean>>({});
  const isClassroom = mode === "classroom";
  const isEditor = mode === "editor";
  const isStudent = mode === "student";
  // MCQ options are always selectable (editor preview, lesson preview, classroom) —
  // decoupled from written answer spaces which stay exam-paper static outside student mode.
  const mcqInteractive = true;
  // Written answers use the lined exam-paper textarea and must be typeable in the
  // student lesson view AND the teacher/editor preview (for testing). Classroom
  // presentation mode keeps the static exam-paper lines.
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
    const options = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];
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
  const firstLabel = firstPart ? partLabel(firstPart, 0) : "";
  const firstOptions =
    firstPart && Array.isArray(firstPart.options)
      ? firstPart.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
  const firstIsMcq = firstPart && String(firstPart.type).toLowerCase() === "mcq" && firstOptions.length > 0;

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

          {firstPart && (
            <section className="exam-composite__part exam-composite__part--inline">
              <div className="exam-composite__part-prompt">
                <span className="exam-composite__part-label">({firstLabel})</span>
                <p className="exam-composite__part-text">{firstPart.questionText}</p>
                <CompositePartMarks marks={firstPart.marks} />
              </div>
              {firstIsMcq ? (
                <CompositeMcqOptions
                  options={firstOptions}
                  partIndex={0}
                  interactive={mcqInteractive}
                  selectedIndex={mcqSelections[0]}
                  onSelect={(i) => setMcqSelections((prev) => ({ ...prev, 0: i }))}
                  disabled={isStudent && Boolean(checkedParts[0])}
                  marked={Boolean(checkedParts[0])}
                  mcqGrade={firstPart ? getPartMcqGrade(firstPart, 0) : null}
                />
              ) : writtenInteractive ? (
                <CompositeAnswerLines
                  marks={firstPart.marks}
                  value={answers[0]}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, 0: v }))}
                  interactive
                  disabled={isStudent && Boolean(checkedParts[0])}
                />
              ) : (
                <CompositeAnswerLines marks={firstPart.marks} interactive={false} />
              )}
              {isStudent && firstPart ? (
                <CompositePartMarkingSection
                  part={firstPart}
                  partIndex={0}
                  checked={Boolean(checkedParts[0])}
                  onCheck={() => markPartChecked(0)}
                  mcqSelectedIndex={mcqSelections[0]}
                  writtenAnswer={answers[0]}
                />
              ) : null}
            </section>
          )}
        </div>
      </div>

      {restParts.length > 0 && (
        <div className="exam-composite__written-parts">
          {restParts.map((part, i) => {
            const idx = i + 1;
            return (
              <CompositeWrittenPart
                key={idx}
                part={part}
                index={idx}
                showAnswerSpace={writtenInteractive}
                mcqInteractive={mcqInteractive}
                answerValue={answers[idx]}
                onAnswerChange={(v) => setAnswers((prev) => ({ ...prev, [idx]: v }))}
                mcqSelectedIndex={mcqSelections[idx]}
                onMcqSelect={(i) => setMcqSelections((prev) => ({ ...prev, [idx]: i }))}
                enableMarking={isStudent}
                partChecked={Boolean(checkedParts[idx])}
                onPartCheck={() => markPartChecked(idx)}
                partMcqGrade={getPartMcqGrade(part, idx)}
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
              const isMcqPart = String(part.type).toLowerCase() === "mcq" && options.length > 0;
              const correctIdx = typeof part.correctIndex === "number" ? part.correctIndex : -1;
              const correctOption =
                isMcqPart && correctIdx >= 0 && options[correctIdx] != null ? options[correctIdx] : "";
              const markScheme = Array.isArray(part.markScheme)
                ? part.markScheme.map((l) => String(l ?? "").trim()).filter(Boolean)
                : [];

              return (
                <div key={idx} className="exam-composite__reveal-part">
                  <div className="exam-composite__reveal-part-label">({label})</div>
                  {isMcqPart && correctOption ? (
                    <p className="exam-composite__reveal-answer">
                      Correct answer: <strong>{String.fromCharCode(65 + correctIdx)}</strong> — {correctOption}
                    </p>
                  ) : null}
                  {markScheme.length > 0 ? (
                    <div className="exam-composite__reveal-scheme">
                      {!isMcqPart && <span className="exam-composite__reveal-scheme-label">Mark scheme:</span>}
                      <ul className="exam-composite__reveal-list">
                        {markScheme.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    !isMcqPart && (
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

export function ExamQuestionBlock({
  question,
  loading = false,
  missing = false,
  mode = "student",
  presentation = "default",
}: ExamQuestionBlockProps): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const v12 = presentation === "v12";
  const isClassroom = mode === "classroom";
  const isEditor = mode === "editor";

  const isSingleShortStudent =
    Boolean(question) &&
    !loading &&
    !missing &&
    mode === "student" &&
    !isCompositeQuestion(question!) &&
    String(question!.type ?? "short").toLowerCase() !== "mcq";

  const shortGrade = useMemo(() => {
    if (!isSingleShortStudent || !checked || !question) return null;
    const markScheme = resolveMarkSchemeLines(question);
    const model = resolveModelAnswer(question);
    return gradeShortAnswer({
      userAnswer: draftAnswer,
      markScheme,
      correctAnswer: model || resolveMcqCorrectAnswer(question),
      marks: question.marks ?? 1,
    });
  }, [isSingleShortStudent, checked, draftAnswer, question]);

  const shortFeedbackStatus = shortGrade
    ? deriveShortAnswerFeedbackStatus(shortGrade.score, shortGrade.maxMarks)
    : "incorrect";

  const shortImprovementTip = useMemo(() => {
    if (!shortGrade) return undefined;
    const missing = (shortGrade.missing || []).map((l) => String(l ?? "").trim()).filter(Boolean);
    if (missing.length > 0) return `Revise: ${missing[0]}`;
    return buildShortAnswerImprovementTip(shortGrade);
  }, [shortGrade]);

  const boxStyle: React.CSSProperties = v12
    ? {
        marginTop: 20,
        marginBottom: 8,
        padding: isClassroom ? 20 : 16,
        borderRadius: 14,
        background: isClassroom ? "#fff" : "#fafbff",
        border: isClassroom ? "2px solid #c4b5fd" : "1px solid #e8e0f5",
        textAlign: "left" as const,
      }
    : {
        marginTop: 14,
        marginBottom: 10,
        padding: isClassroom ? 20 : 16,
        borderRadius: 14,
        background: isClassroom ? "#fff" : "#fafbff",
        border: isClassroom ? "2px solid rgba(126,34,206,0.35)" : "1px solid #e8e0f5",
        boxShadow: isClassroom ? "0 2px 12px rgba(126,34,206,0.08)" : undefined,
        textAlign: "left" as const,
      };

  if (loading) {
    return (
      <div style={boxStyle} className="exam-question-block">
        <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>Loading exam question…</p>
      </div>
    );
  }

  if (missing || !question) {
    return (
      <div style={boxStyle} className="exam-question-block">
        <div style={{ fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>Exam Question</div>
        <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
          This exam question is no longer available. It may have been removed or is not published yet.
        </p>
      </div>
    );
  }

  if (isCompositeQuestion(question)) {
    return (
      <CompositeExamQuestion question={question} mode={mode} presentation={presentation} boxStyle={boxStyle} />
    );
  }

  const qType = String(question.type ?? "short").toLowerCase();
  const options = Array.isArray(question.options) ? question.options.map((o) => String(o ?? "")) : [];
  const isMcq = qType === "mcq" && options.filter((o) => o.trim()).length >= 2;
  const markSchemeLines = resolveMarkSchemeLines(question);
  const modelAnswer = resolveModelAnswer(question);
  const metaBits = [question.subject, question.examBoard, question.level, question.topic]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  const imageUrl = question.imageUrl && String(question.imageUrl).trim() ? String(question.imageUrl).trim() : "";
  const hasImage = Boolean(imageUrl);

  const wrapWithImageLayout = (body: React.ReactNode, header?: React.ReactNode, footer?: React.ReactNode) => {
    if (!hasImage) {
      return (
        <div style={boxStyle} className="exam-question-block">
          {header}
          {body}
          {footer}
        </div>
      );
    }
    return (
      <div style={boxStyle} className="exam-question-block exam-question-block--with-image">
        {header}
        <div className="exam-question-block__split">
          <ExamQuestionImagePanel imageUrl={imageUrl} />
          <div className="exam-question-block__content">{body}</div>
        </div>
        {footer}
      </div>
    );
  };

  if (isMcq && isEditor) {
    const mcqBody = (
      <>
        {metaBits.length > 0 && (
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{metaBits.join(" · ")}</div>
        )}
        {question.marks != null && (
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
            {question.marks} {question.marks === 1 ? "mark" : "marks"}
          </div>
        )}
        <InlineSelfCheckBlock
          prompt={question.question}
          questionType="mcq"
          options={options}
          correctAnswer={resolveMcqCorrectAnswer(question)}
          markScheme={markSchemeLines}
          explanation={modelAnswer || undefined}
          presentation={presentation}
          headingLabel="Exam question"
        />
      </>
    );

    if (!hasImage) {
      return <div style={boxStyle} className="exam-question-block">{mcqBody}</div>;
    }
    return wrapWithImageLayout(mcqBody);
  }

  if (isMcq && mode === "student") {
    return (
      <SingleExamMcqStudentBlock
        question={question}
        options={options}
        markSchemeLines={markSchemeLines}
        modelAnswer={modelAnswer}
        metaBits={metaBits}
        imageUrl={imageUrl}
        boxStyle={boxStyle}
      />
    );
  }

  const header = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: "#374151" }}>Exam question</span>
        {question.marks != null && (
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            ({question.marks} {question.marks === 1 ? "mark" : "marks"})
          </span>
        )}
        {question.status === "draft" && isEditor && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#fef3c7",
              color: "#92400e",
            }}
          >
            Draft
          </span>
        )}
      </div>
      {metaBits.length > 0 && (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: hasImage ? 12 : 10 }}>{metaBits.join(" · ")}</div>
      )}
    </>
  );

  const showStudentAnswer = !isClassroom && !isEditor && qType !== "mcq";
  const hasDraftAnswer = draftAnswer.trim() !== "";

  const answerSection = showStudentAnswer ? (
    <>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        Your answer
      </label>
      <textarea
        value={draftAnswer}
        onChange={(e) => setDraftAnswer(e.target.value)}
        rows={3}
        placeholder="Write your answer here…"
        disabled={checked}
        style={{
          width: "100%",
          maxWidth: "100%",
          minHeight: 80,
          boxSizing: "border-box",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #d1d5db",
          fontSize: 14,
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {!checked ? (
          <button
            type="button"
            disabled={!hasDraftAnswer}
            onClick={() => setChecked(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "2px solid rgba(59,130,246,0.4)",
              background: hasDraftAnswer ? "rgba(59,130,246,0.12)" : "#f1f5f9",
              cursor: hasDraftAnswer ? "pointer" : "not-allowed",
              fontWeight: 700,
              alignSelf: "flex-start",
            }}
          >
            Check answer
          </button>
        ) : shortGrade ? (
          <AnswerFeedbackPanel
            status={shortFeedbackStatus}
              marksAwarded={shortGrade.score}
              totalMarks={shortGrade.maxMarks}
              yourAnswer={draftAnswer.trim()}
              markScheme={markSchemeLines}
              modelAnswer={modelAnswer || undefined}
              improvementTip={shortImprovementTip}
              contradictionFeedback={shortGrade.contradictionFeedback}
              markSchemeHits={shortGrade.hits}
              markSchemeMissing={shortGrade.missing}
            />
        ) : null}
      </div>
    </>
  ) : null;

  const revealButton = (
    <div style={{ marginTop: showStudentAnswer ? 12 : 10 }}>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #7c3aed",
          background: revealed ? "#f5f3ff" : "white",
          color: "#5b21b6",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {revealed ? "Hide answer / mark scheme" : "Reveal answer / mark scheme"}
      </button>
    </div>
  );

  const revealedPanel = revealed ? (
    <div
      className="exam-question-block__reveal"
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        fontSize: 14,
        color: "#1f2937",
      }}
    >
      {markSchemeLines.length > 0 && (
        <ul style={{ margin: "0 0 12px 0", paddingLeft: 20 }}>
          {markSchemeLines.map((line, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {isMcq && resolveMcqCorrectAnswer(question) ? (
        <div>
          <strong style={{ display: "block", marginBottom: 6 }}>Correct answer</strong>
          <div>{resolveMcqCorrectAnswer(question)}</div>
        </div>
      ) : null}
      {modelAnswer ? (
        <div>
          <strong style={{ display: "block", marginBottom: 6 }}>Model answer</strong>
          <div style={{ whiteSpace: "pre-wrap" }}>{modelAnswer}</div>
        </div>
      ) : (
        !markSchemeLines.length &&
        !isMcq && <span style={{ color: "#6b7280" }}>No mark scheme available.</span>
      )}
    </div>
  ) : null;

  const mainBody = (
    <>
      <div
        style={{
          color: "#1f2937",
          marginBottom: isClassroom ? 16 : 12,
          whiteSpace: "pre-wrap",
          fontSize: isClassroom ? "1.125rem" : undefined,
          lineHeight: 1.5,
        }}
      >
        {question.question}
      </div>
      {isMcq && options.length > 0 && (
        <ul style={{ margin: "0 0 12px 0", paddingLeft: 20, color: "#374151" }}>
          {options
            .map((opt) => opt.trim())
            .filter(Boolean)
            .map((opt, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {opt}
              </li>
            ))}
        </ul>
      )}
      {!hasImage && answerSection}
      {!hasImage && revealButton}
    </>
  );

  const belowSplit = hasImage ? (
    <div className="exam-question-block__below-split">
      {answerSection}
      {revealButton}
      {revealedPanel}
    </div>
  ) : (
    revealedPanel
  );

  return wrapWithImageLayout(mainBody, header, belowSplit);
}
