import React, { useEffect, useMemo, useState } from "react";
import { logAttempt } from "../../utils/attempts";
import { gradeShortAnswer } from "../../utils/gradeShortAnswer";

export type PracticeQuestionLite = {
  id: string;
  question: string;
  type: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  markScheme?: string[];
  topicKey?: string;
  topic?: string;
};

type SelfCheckRating = "correct" | "partial" | "revise" | null;

const answerBoxStyle: React.CSSProperties = {
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#374151",
  fontSize: "1rem",
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
};

const sectionLabelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  color: "#374151",
  marginBottom: 4,
};

export function PracticeShortQuestion({
  q,
  lessonId,
  hideExplanationLabel,
}: {
  q: PracticeQuestionLite;
  lessonId?: string;
  hideExplanationLabel?: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [selfRating, setSelfRating] = useState<SelfCheckRating>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [recorded, setRecorded] = useState(false);
  const hasAnswer = answer.trim() !== "";

  const modelAnswer = q.correctAnswer != null ? String(q.correctAnswer).trim() : "";
  const markSchemeLines = Array.isArray(q.markScheme)
    ? q.markScheme.map((line) => String(line ?? "").trim()).filter(Boolean)
    : [];
  const maxMarks = typeof q.marks === "number" && q.marks > 0 ? q.marks : 0;

  const estimatedGrade = useMemo(() => {
    if (!checked || !submittedAnswer.trim()) return null;
    if (!modelAnswer && markSchemeLines.length === 0) return null;
    return gradeShortAnswer({
      userAnswer: submittedAnswer,
      markScheme: markSchemeLines.length ? markSchemeLines : undefined,
      correctAnswer: modelAnswer || undefined,
      marks: maxMarks > 0 ? maxMarks : 1,
    });
  }, [checked, submittedAnswer, modelAnswer, markSchemeLines, maxMarks]);

  useEffect(() => {
    if (!lessonId || !q.id || selfRating === null || confidence === null || recorded) return;
    logAttempt({
      lessonId,
      source: "practice",
      questionId: q.id,
      questionType: "short",
      answerText: submittedAnswer.trim(),
      isCorrect: selfRating === "correct",
      confidence,
    });
    setRecorded(true);
  }, [lessonId, q.id, selfRating, confidence, recorded, submittedAnswer]);

  const handleCheck = () => {
    const trimmed = answer.trim();
    if (!trimmed) return;
    setSubmittedAnswer(trimmed);
    setChecked(true);
    setSelfRating(null);
    setConfidence(null);
    setRecorded(false);
  };

  const handleTryAgain = () => {
    setAnswer("");
    setSubmittedAnswer("");
    setChecked(false);
    setSelfRating(null);
    setConfidence(null);
    setRecorded(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {!checked ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            rows={3}
            style={{
              width: "100%",
              maxWidth: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: "1rem",
              lineHeight: 1.5,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {!checked ? (
          <>
            {!hasAnswer ? (
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                Type an answer before checking.
              </p>
            ) : null}
            <button
              type="button"
              disabled={!hasAnswer}
              onClick={handleCheck}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "2px solid rgba(59,130,246,0.4)",
                background: hasAnswer ? "rgba(59,130,246,0.12)" : "#f1f5f9",
                cursor: hasAnswer ? "pointer" : "not-allowed",
                fontWeight: 700,
                alignSelf: "flex-start",
              }}
            >
              Check answer
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, color: "#374151", fontSize: "0.95rem" }}>
              Compare your answer with the model answer below.
            </p>

            {maxMarks > 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "#4b5563" }}>
                This question is worth {maxMarks} {maxMarks === 1 ? "mark" : "marks"}.
              </p>
            ) : null}

            {estimatedGrade ? (
              <p style={{ margin: 0, fontSize: 14, color: "#4b5563" }}>
                Estimated score (guide): {estimatedGrade.score} / {estimatedGrade.maxMarks}
                <span style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  Not an official mark — use self-check below.
                </span>
              </p>
            ) : null}

            <div style={{ marginTop: 4 }}>
              <span style={sectionLabelStyle}>Your answer</span>
              <div style={answerBoxStyle} data-testid="practice-short-your-answer">
                {submittedAnswer}
              </div>
            </div>

            <div>
              <span style={sectionLabelStyle}>Model answer</span>
              <div style={{ ...answerBoxStyle, background: "#f9fafb" }} data-testid="practice-short-model-answer">
                {modelAnswer || "—"}
              </div>
            </div>

            {markSchemeLines.length > 0 ? (
              <div>
                <span style={sectionLabelStyle}>Mark scheme</span>
                <ul
                  style={{
                    margin: "6px 0 0",
                    paddingLeft: 20,
                    color: "#4b5563",
                    fontSize: "0.95rem",
                    lineHeight: 1.5,
                  }}
                  data-testid="practice-short-mark-scheme"
                >
                  {markSchemeLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selfRating === null ? (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>Self-check your answer</span>
                <button
                  type="button"
                  onClick={() => setSelfRating("correct")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "2px solid #22c55e",
                    background: "rgba(34,197,94,0.1)",
                    color: "#15803d",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  I was correct
                </button>
                <button
                  type="button"
                  onClick={() => setSelfRating("partial")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "2px solid #f59e0b",
                    background: "rgba(245,158,11,0.12)",
                    color: "#b45309",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  I was partly correct
                </button>
                <button
                  type="button"
                  onClick={() => setSelfRating("revise")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "2px solid #dc2626",
                    background: "rgba(220,38,38,0.1)",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  I need to revise this
                </button>
              </div>
            ) : !recorded ? (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#374151" }}>Confidence?</span>
                {([1, 2, 3] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setConfidence(c)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `2px solid ${confidence === c ? "rgba(59,130,246,0.8)" : "rgba(0,0,0,0.14)"}`,
                      background: confidence === c ? "rgba(59,130,246,0.12)" : "white",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {c === 1 ? "Low (1)" : c === 2 ? "Medium (2)" : "High (3)"}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>Recorded. Thanks.</div>
            )}

            {q.explanation ? (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                {!hideExplanationLabel ? (
                  <strong style={{ color: "#374151" }}>Explanation:</strong>
                ) : null}
                <div
                  style={{
                    marginTop: hideExplanationLabel ? 0 : 4,
                    color: "#4b5563",
                    fontSize: "1rem",
                  }}
                >
                  {q.explanation}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleTryAgain}
              style={{
                marginTop: 12,
                padding: "8px 14px",
                borderRadius: 8,
                border: "2px solid rgba(0,0,0,0.14)",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
                alignSelf: "flex-start",
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
