/**
 * PR-UX-LESSON-3: Single checkpoint component for structured lessons.
 * Exactly one checkpoint per page; identical typography and spacing.
 * No auto-reveal: user must click "Check answer" to see correctness.
 */
import React, { useState, useEffect } from "react";
import "./student/lessonStudentView.css";
import { logAttempt } from "../../utils/attempts";
import { SubscribeCTA } from "../SubscribeCTA";

const CONTENT_FONT = 16;
const TITLE_STYLE: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "#6b7280",
  marginBottom: 8,
  fontWeight: 600,
};
const PROMPT_STYLE: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 12,
  color: "#111827",
  fontSize: CONTENT_FONT,
  lineHeight: 1.6,
};

export interface LessonCheckpointProps {
  mode: "mcq" | "short";
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  /** Unique ID for radio inputs (e.g. pageId) */
  name: string;
  lessonId?: string;
  /** Stable lesson page id (`lesson.pages[].pageId`) for attempt analytics. */
  pageId?: string;
  /** Optional revision token for analytics when checkpoint content changes. */
  checkpointRevision?: string | number;
  entitled?: boolean;
  /** V12 student view: calmer chrome, no "Explanation:" / "Checkpoint" visible labels */
  presentation?: "default" | "v12";
}

export function LessonCheckpoint({
  mode,
  prompt,
  options = [],
  correctAnswer: correctAnswerProp = "",
  explanation,
  name,
  lessonId,
  pageId,
  checkpointRevision,
  entitled = false,
  presentation = "default",
}: LessonCheckpointProps) {
  const correctAnswer = String(correctAnswerProp ?? "").trim();

  if (mode === "mcq") {
    return (
      <LessonCheckpointMCQ
        prompt={prompt}
        options={options}
        correctAnswer={correctAnswer}
        explanation={explanation}
        name={name}
        lessonId={lessonId}
        entitled={entitled}
        presentation={presentation}
      />
    );
  }

  return (
    <LessonCheckpointShort
      prompt={prompt}
      correctAnswer={correctAnswer}
      explanation={explanation}
      lessonId={lessonId}
      entitled={entitled}
      presentation={presentation}
    />
  );
}

function LessonCheckpointMCQ({
  prompt,
  options,
  correctAnswer,
  explanation,
  name,
  lessonId,
  pageId,
  checkpointRevision,
  entitled,
  presentation = "default",
}: {
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  name: string;
  lessonId?: string;
  pageId?: string;
  checkpointRevision?: string | number;
  entitled: boolean;
  presentation?: "default" | "v12";
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [recorded, setRecorded] = useState(false);
  const isCorrect = checked && selected !== null && correctAnswer !== "" && selected.trim() === correctAnswer;

  const getOptionBg = (opt: string) => {
    const optTrim = String(opt ?? "").trim();
    const isSelected = selected !== null && selected.trim() === optTrim;
    const isCorrectOpt = correctAnswer !== "" && optTrim === correctAnswer;
    if (!checked) return "white";
    if (entitled) {
      if (isCorrectOpt) return "#dcfce7";
      if (isSelected && !isCorrect) return "#fee2e2";
      return "white";
    }
    if (isSelected) return isCorrect ? "#dcfce7" : "#fee2e2";
    return "white";
  };

  const v12 = presentation === "v12";

  return (
    <div
      className={v12 ? "lesson-checkpoint-v12" : undefined}
      style={{
        marginTop: v12 ? 28 : 14,
        padding: 16,
        borderRadius: 14,
        background: "#f8f9fa",
        border: "2px solid rgba(59,130,246,0.25)",
        boxShadow: v12 ? "none" : "0 0 0 2px rgba(59,130,246,0.08)",
        textAlign: "left",
      }}
    >
      {v12 ? (
        <span className="lesson-sr-only">Quick check</span>
      ) : (
        <div style={TITLE_STYLE}>Checkpoint</div>
      )}
      <div style={PROMPT_STYLE}>{prompt}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt, i) => (
          <div
            key={i}
            className="lr-mcq-option"
            role="button"
            tabIndex={0}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "2px solid rgba(0,0,0,0.14)",
              background: getOptionBg(opt),
              cursor: checked ? "default" : "pointer",
              fontWeight: 650,
              fontSize: CONTENT_FONT,
            }}
            onClick={() => { if (!checked) setSelected(String(opt ?? "").trim()); }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !checked) {
                e.preventDefault();
                setSelected(String(opt ?? "").trim());
              }
            }}
          >
            <div className="lr-mcq-text" style={{ color: "#374151" }}>{opt}</div>
            <div className="lr-mcq-radio">
              <input
                type="radio"
                name={name}
                value={String(opt ?? "")}
                checked={selected !== null && String(selected).trim() === String(opt ?? "").trim()}
                onChange={() => { if (!checked) setSelected(String(opt ?? "").trim()); }}
                disabled={checked}
              />
            </div>
          </div>
        ))}
      </div>
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
              opacity: selected !== null ? 1 : 0.7,
            }}
          >
            Check answer
          </button>
        ) : (
          <>
            <div style={{ marginTop: 2 }}>
              {isCorrect ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✅ Correct</span> : <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ Not quite</span>}
            </div>
            {!recorded && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#374151" }}>Confidence?</span>
                {([1, 2, 3] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setConfidence(c);
                      if (lessonId) {
                        logAttempt({
                          lessonId,
                          source: "checkpoint",
                          questionType: "mcq",
                          selected: selected ?? "",
                          isCorrect,
                          confidence: c,
                          ...(pageId ? { pageId } : {}),
                          ...(checkpointRevision !== undefined ? { checkpointRevision } : {}),
                        });
                      }
                      setRecorded(true);
                    }}
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
            )}
            {recorded && <div style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>Recorded. Thanks.</div>}
            {entitled && explanation ? (
              v12 ? (
                <div className="lesson-checkpoint-v12-explain">{explanation}</div>
              ) : (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                  <strong style={{ color: "#374151" }}>Explanation:</strong>
                  <div style={{ marginTop: 4, color: "#4b5563", fontSize: CONTENT_FONT }}>{explanation}</div>
                </div>
              )
            ) : null}
            {checked && !entitled && (
              <div style={{ marginTop: 8, opacity: 0.85, fontSize: "0.9rem", color: "#6b7280" }}>Subscribe to see the full explanation.</div>
            )}
            <button
              type="button"
              onClick={() => { setSelected(null); setChecked(false); setConfidence(null); setRecorded(false); }}
              style={{ marginTop: 6, padding: "8px 14px", borderRadius: 8, border: "2px solid rgba(0,0,0,0.14)", background: "white", cursor: "pointer", fontWeight: 700 }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LessonCheckpointShort({
  prompt,
  correctAnswer,
  explanation,
  lessonId,
  pageId,
  checkpointRevision,
  entitled,
  presentation = "default",
}: {
  prompt: string;
  correctAnswer: string;
  explanation?: string;
  lessonId?: string;
  pageId?: string;
  checkpointRevision?: string | number;
  entitled: boolean;
  presentation?: "default" | "v12";
}) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [selfMarked, setSelfMarked] = useState<boolean | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [recorded, setRecorded] = useState(false);
  const hasAnswer = answer.trim() !== "";

  useEffect(() => {
    if (!entitled || !lessonId || selfMarked === null || confidence === null || recorded) return;
    logAttempt({
      lessonId,
      source: "checkpoint",
      questionType: "short",
      answerText: answer.trim(),
      isCorrect: selfMarked,
      confidence,
      ...(pageId ? { pageId } : {}),
      ...(checkpointRevision !== undefined ? { checkpointRevision } : {}),
    });
    setRecorded(true);
  }, [entitled, lessonId, pageId, checkpointRevision, selfMarked, confidence, recorded, answer]);

  const v12 = presentation === "v12";

  return (
    <div
      className={v12 ? "lesson-checkpoint-v12" : undefined}
      style={{
        marginTop: v12 ? 28 : 14,
        padding: 16,
        borderRadius: 14,
        background: "#f8f9fa",
        border: "2px solid rgba(59,130,246,0.25)",
        boxShadow: v12 ? "none" : "0 0 0 2px rgba(59,130,246,0.08)",
        textAlign: "left",
      }}
    >
      {v12 ? <span className="lesson-sr-only">Quick check</span> : <div style={TITLE_STYLE}>Checkpoint</div>}
      <div style={PROMPT_STYLE}>{prompt}</div>
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer..."
          disabled={checked}
          style={{
            width: "100%",
            maxWidth: 500,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: CONTENT_FONT,
          }}
        />
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {!checked ? (
          <button
            type="button"
            disabled={!hasAnswer}
            onClick={() => setChecked(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "2px solid rgba(59,130,246,0.4)",
              background: hasAnswer ? "rgba(59,130,246,0.12)" : "#f1f5f9",
              cursor: hasAnswer ? "pointer" : "not-allowed",
              fontWeight: 700,
              opacity: hasAnswer ? 1 : 0.7,
            }}
          >
            Check answer
          </button>
        ) : (
          <>
            <div style={{ marginTop: 2, color: "#374151", fontSize: "0.95rem" }}>
              {v12 ? "Compare with the reference below." : "Compare your answer to the model answer below."}
            </div>
            {entitled ? (
              <>
                {v12 ? (
                  <div className="lesson-checkpoint-v12-model">{correctAnswer || "—"}</div>
                ) : (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
                    <strong style={{ color: "#374151" }}>Model answer:</strong>
                    <div style={{ marginTop: 6, color: "#4b5563", fontSize: CONTENT_FONT }}>{correctAnswer || "—"}</div>
                  </div>
                )}
                {selfMarked === null ? (
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 14, color: "#374151" }}>Was your answer correct?</span>
                    <button type="button" onClick={() => setSelfMarked(true)} style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #22c55e", background: "rgba(34,197,94,0.1)", color: "#15803d", cursor: "pointer", fontWeight: 700 }}>I was correct</button>
                    <button type="button" onClick={() => setSelfMarked(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #dc2626", background: "rgba(220,38,38,0.1)", color: "#b91c1c", cursor: "pointer", fontWeight: 700 }}>I was incorrect</button>
                  </div>
                ) : !recorded ? (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "#374151" }}>Confidence?</span>
                    {([1, 2, 3] as const).map((c) => (
                      <button key={c} type="button" onClick={() => setConfidence(c)} style={{ padding: "6px 12px", borderRadius: 8, border: `2px solid ${confidence === c ? "rgba(59,130,246,0.8)" : "rgba(0,0,0,0.14)"}`, background: confidence === c ? "rgba(59,130,246,0.12)" : "white", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                        {c === 1 ? "Low (1)" : c === 2 ? "Medium (2)" : "High (3)"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>Recorded. Thanks.</div>
                )}
                {explanation ? (
                  v12 ? (
                    <div className="lesson-checkpoint-v12-explain" style={{ marginTop: 12 }}>
                      {explanation}
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                      <strong style={{ color: "#374151" }}>Explanation:</strong>
                      <div style={{ marginTop: 4, color: "#4b5563", fontSize: CONTENT_FONT }}>{explanation}</div>
                    </div>
                  )
                ) : null}
              </>
            ) : (
              <>
                <div style={{ marginTop: 8, opacity: 0.85, fontSize: "0.9rem", color: "#6b7280" }}>Subscribe to see the model answer and explanation.</div>
                <div style={{ marginTop: 10 }}><SubscribeCTA lessonId={lessonId} /></div>
              </>
            )}
            <button
              type="button"
              onClick={() => { setAnswer(""); setChecked(false); setSelfMarked(null); setConfidence(null); setRecorded(false); }}
              style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: "2px solid rgba(0,0,0,0.14)", background: "white", cursor: "pointer", fontWeight: 700 }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
