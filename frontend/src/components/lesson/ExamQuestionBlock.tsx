import React, { useState } from "react";
import type { ExamQuestion, ExamQuestionPart } from "../../api/examQuestions";
import { InlineSelfCheckBlock } from "./InlineSelfCheckBlock";
import { ZoomableImageTrigger } from "./ZoomableImageLightbox";
import "./ExamQuestionBlock.css";

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

function ExamQuestionImagePanel({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="exam-question-block__image-panel">
      <ZoomableImageTrigger
        src={imageUrl}
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
}: {
  options: string[];
  partIndex: number;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  interactive: boolean;
}) {
  const name = `exam-composite-mcq-${partIndex}`;
  return (
    <ul className="exam-composite__mcq-options" role="list">
      {options.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const id = `${name}-opt-${i}`;
        if (interactive) {
          return (
            <li key={i} className="exam-composite__mcq-option">
              <label htmlFor={id} className="exam-composite__mcq-label">
                <input
                  id={id}
                  type="radio"
                  name={name}
                  className="exam-composite__mcq-radio"
                  checked={selectedIndex === i}
                  onChange={() => onSelect?.(i)}
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
}: {
  marks: number | null | undefined;
  value?: string;
  onChange?: (value: string) => void;
  interactive: boolean;
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
      aria-label="Your answer"
    />
  );
}

function CompositeWrittenPart({
  part,
  index,
  showAnswerSpace,
  answerValue,
  onAnswerChange,
  mcqSelectedIndex,
  onMcqSelect,
}: {
  part: ExamQuestionPart;
  index: number;
  showAnswerSpace: boolean;
  answerValue?: string;
  onAnswerChange?: (value: string) => void;
  mcqSelectedIndex?: number;
  onMcqSelect?: (index: number) => void;
}) {
  const label = partLabel(part, index);
  const isMcq = String(part.type).toLowerCase() === "mcq";
  const options = Array.isArray(part.options) ? part.options.map((o) => String(o ?? "").trim()).filter(Boolean) : [];

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
          interactive={showAnswerSpace}
          selectedIndex={mcqSelectedIndex}
          onSelect={onMcqSelect}
        />
      ) : showAnswerSpace ? (
        <CompositeAnswerLines
          marks={part.marks}
          value={answerValue}
          onChange={onAnswerChange}
          interactive
        />
      ) : (
        <CompositeAnswerLines marks={part.marks} interactive={false} />
      )}
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
  const isClassroom = mode === "classroom";
  const isEditor = mode === "editor";
  const showAnswerSpaces = !isClassroom && !isEditor;

  const parts: ExamQuestionPart[] = Array.isArray(question.parts) ? question.parts : [];
  const totalMarks =
    typeof question.totalMarks === "number"
      ? question.totalMarks
      : parts.reduce((sum, p) => sum + (Number.isFinite(Number(p.marks)) ? Number(p.marks) : 0), 0);
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
                src={imageUrl}
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
                  interactive={showAnswerSpaces}
                  selectedIndex={mcqSelections[0]}
                  onSelect={(i) => setMcqSelections((prev) => ({ ...prev, 0: i }))}
                />
              ) : showAnswerSpaces ? (
                <CompositeAnswerLines
                  marks={firstPart.marks}
                  value={answers[0]}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, 0: v }))}
                  interactive
                />
              ) : (
                <CompositeAnswerLines marks={firstPart.marks} interactive={false} />
              )}
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
                showAnswerSpace={showAnswerSpaces}
                answerValue={answers[idx]}
                onAnswerChange={(v) => setAnswers((prev) => ({ ...prev, [idx]: v }))}
                mcqSelectedIndex={mcqSelections[idx]}
                onMcqSelect={(i) => setMcqSelections((prev) => ({ ...prev, [idx]: i }))}
              />
            );
          })}
        </div>
      )}

      <footer className="exam-composite__footer">
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
  const v12 = presentation === "v12";
  const isClassroom = mode === "classroom";
  const isEditor = mode === "editor";

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

  if (isMcq && !isClassroom) {
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
