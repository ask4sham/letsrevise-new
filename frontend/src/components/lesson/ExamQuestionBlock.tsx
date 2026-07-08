import React, { useMemo, useState } from "react";
import type { ExamQuestion } from "../../api/examQuestions";
import { CompositeExamShell } from "./examComposite/CompositeExamShell";
import { inlineExamQuestionImageSrc, isCompositeQuestion } from "./examComposite/compositeUtils";
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
      <CompositeExamShell question={question} mode={mode} presentation={presentation} boxStyle={boxStyle} />
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
