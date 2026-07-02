import React, { useState } from "react";
import type { ExamQuestion } from "../../api/examQuestions";
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
