import React, { useMemo, useState, useEffect, useRef } from "react";
import { ExplainMyMistakeButton } from "../ai/ExplainMyMistakeButton";
import { AnswerFeedbackPanel } from "../lesson/AnswerFeedbackPanel";
import { RevisionQuizResultCard } from "../lesson/RevisionQuizResultCard";
import { buildMcqFeedback, gradeMcq, type McqGradeResult } from "../../utils/gradeMcq";
import {
  gradeShortAnswer,
  type GradeShortAnswerResult,
} from "../../utils/gradeShortAnswer";
import "../lesson/student/lessonStudentView.css";

export type { GradeShortAnswerResult };

export type QuizQuestion =
  | {
      id: string;
      type: "mcq";
      question: string;
      options: string[];
      correctAnswer: string;
      explanation?: string;
      tags?: string[];
      difficulty?: number;
      marks?: number;
    }
  | {
      id: string;
      type: "short";
      question: string;
      correctAnswer: string;
      explanation?: string;
      tags?: string[];
      difficulty?: number;
      marks?: number;
    }
  | {
      id: string;
      type: "exam";
      question: string;
      correctAnswer?: string;
      markScheme?: string[];
      explanation?: string;
      tags?: string[];
      difficulty?: number;
      marks?: number;
    };

function quizMcqOptionIndex(options: string[], value: string | null | undefined): number {
  if (value == null) return -1;
  const sel = String(value).trim();
  if (!sel) return -1;
  const idx = options.findIndex((o) => String(o ?? "").trim() === sel);
  return idx >= 0 ? idx : -1;
}

function quizMcqMarkSchemeLines(explanation?: string): string[] {
  const expl = explanation != null ? String(explanation).trim() : "";
  return expl ? [expl] : [];
}

function formatQuizMcqAnswerLine(grade: McqGradeResult | null, selected: string): string {
  if (!grade) return "";
  if (grade.selectedLabel && grade.selectedOption) {
    return `${grade.selectedLabel} — ${grade.selectedOption}`;
  }
  return grade.selectedOption || selected || "";
}

function getQuizMcqOptionStyle(
  checked: boolean,
  mcqGrade: McqGradeResult | null,
  index: number
): { background: string; border: string; icon: string | null } {
  const baseBorder = "2px solid rgba(0,0,0,0.14)";
  if (!checked || !mcqGrade) {
    return { background: "white", border: baseBorder, icon: null };
  }
  if (index === mcqGrade.correctIndex) {
    return { background: "#dcfce7", border: "2px solid #22c55e", icon: "✅" };
  }
  if (index === mcqGrade.selectedIndex && mcqGrade.status === "incorrect") {
    return { background: "#fee2e2", border: "2px solid #ef4444", icon: "❌" };
  }
  return { background: "white", border: baseBorder, icon: null };
}

export type QuizCompletePayload = {
  questionCount: number;
  questionIds: string[];
  /** Auto-gradable correct count shown on the live complete screen. */
  score: number;
  gradableCount: number;
};

/** Restored completion display. `score: null` = legacy unknown (do not show 0/N). */
export type QuizRestoredResult = {
  score: number | null;
  questionCount: number;
};

function computeAutoGradableScore(
  questions: QuizQuestion[],
  answers: Record<string, string>
): { score: number; gradableCount: number } {
  let score = 0;
  let gradableCount = 0;
  for (const qu of questions) {
    if (qu.type === "mcq") {
      gradableCount += 1;
      const a = answers[qu.id];
      if (a && a.trim() === qu.correctAnswer.trim()) score += 1;
    } else if (qu.type === "short") {
      gradableCount += 1;
      const a = (answers[qu.id] ?? "").toLowerCase();
      const c = qu.correctAnswer.toLowerCase();
      if (a && (a === c || a.includes(c) || c.includes(a))) score += 1;
    }
  }
  return { score, gradableCount };
}

export function QuizView({
  questions,
  title = "Quiz",
  onQuestionAnswered,
  onContinueLesson,
  onQuizComplete,
  onQuizReset,
  initialComplete = false,
  restoredResult = null,
  completeExtra,
}: {
  questions: QuizQuestion[];
  title?: string;
  /** PR — Adaptive Testing Loop: called when user checks an answer (correct: boolean). */
  onQuestionAnswered?: (correct: boolean) => void;
  /** Optional: called when student clicks "Continue lesson" on the completion screen. */
  onContinueLesson?: () => void;
  /** Fired once when Finish quiz shows the Quiz complete result. */
  onQuizComplete?: (payload: QuizCompletePayload) => void;
  /** Fired when Retry quiz clears completion. */
  onQuizReset?: () => void;
  /** Restore Quiz complete screen after reload for the same question set. */
  initialComplete?: boolean;
  /** Saved score/count for honest restore (null score = omit numeric result). */
  restoredResult?: QuizRestoredResult | null;
  /** Rendered beneath Quiz complete actions (e.g. fresh-practice CTA). */
  completeExtra?: React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastGrade, setLastGrade] = useState<GradeShortAnswerResult | null>(null);
  const [isQuizComplete, setIsQuizComplete] = useState(() => !!initialComplete);
  const completeFiredRef = useRef(!!initialComplete);
  const [helpExpanded, setHelpExpanded] = useState<boolean>(() => {
    // Load user preference from localStorage; default collapsed so question is prominent
    try {
      const saved = localStorage.getItem("quiz_help_expanded");
      return saved === "true"; // Default to false (collapsed) if not saved
    } catch {
      return false; // Default to collapsed
    }
  });

  const q = questions[i];

  const mcqOptions = useMemo(
    () => (q?.type === "mcq" ? (q.options || []).map((o) => String(o ?? "")) : []),
    [q]
  );
  const mcqSelectedAnswer = q?.type === "mcq" ? String(answers[q.id] ?? "").trim() : "";
  const mcqCorrectAnswer = q?.type === "mcq" ? String(q.correctAnswer ?? "").trim() : "";
  const mcqCorrectIndex = useMemo(
    () => quizMcqOptionIndex(mcqOptions, mcqCorrectAnswer),
    [mcqOptions, mcqCorrectAnswer]
  );
  const mcqSelectedIndex = useMemo(
    () => (showFeedback && q?.type === "mcq" ? quizMcqOptionIndex(mcqOptions, mcqSelectedAnswer) : -1),
    [showFeedback, q, mcqOptions, mcqSelectedAnswer]
  );
  const mcqMarkSchemeLines = useMemo(
    () => (q?.type === "mcq" ? quizMcqMarkSchemeLines(q.explanation) : []),
    [q]
  );
  const mcqGrade = useMemo(() => {
    if (q?.type !== "mcq" || !showFeedback || mcqSelectedIndex < 0 || mcqCorrectIndex < 0) return null;
    return gradeMcq(mcqSelectedIndex, mcqCorrectIndex, mcqOptions, q.marks ?? 1);
  }, [q, showFeedback, mcqSelectedIndex, mcqCorrectIndex, mcqOptions]);
  const mcqFeedback = useMemo(() => {
    if (!mcqGrade || q?.type !== "mcq") return undefined;
    return buildMcqFeedback({
      grade: mcqGrade,
      options: mcqOptions,
      markScheme: mcqMarkSchemeLines,
      explanation: q.explanation,
      correctAnswer: mcqCorrectAnswer,
    });
  }, [mcqGrade, mcqOptions, mcqMarkSchemeLines, q, mcqCorrectAnswer]);

  // Save help state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem("quiz_help_expanded", helpExpanded.toString());
    } catch (error) {
      // Silently fail if localStorage is not available
    }
  }, [helpExpanded]);

  useEffect(() => {
    if (initialComplete) {
      setIsQuizComplete(true);
      completeFiredRef.current = true;
    }
  }, [initialComplete]);

  const liveGraded = useMemo(
    () => computeAutoGradableScore(questions, answers),
    [answers, questions]
  );
  const score = liveGraded.score;

  const handleCheck = () => {
    if (q.type === "short") {
      const userAnswer = answers[q.id] || "";
      
      const result = gradeShortAnswer({
        userAnswer,
        markScheme: undefined, // short questions don't have markScheme
        correctAnswer: q.correctAnswer,
        marks: q.marks ?? 1,
      });

      setLastGrade(result);
      setShowFeedback(true);
      const correct = result.score >= result.maxMarks;
      onQuestionAnswered?.(correct);
      return;
    }
    
    if (q.type === "exam") {
      const userAnswer = answers[q.id] || "";
      
      const result = gradeShortAnswer({
        userAnswer,
        markScheme: q.markScheme, // exam questions have markScheme
        correctAnswer: q.correctAnswer,
        marks: q.marks ?? 1,
      });

      setLastGrade(result);
      setShowFeedback(true);
      const correct = result.score >= result.maxMarks;
      onQuestionAnswered?.(correct);
      return;
    }
    
    // For MCQ questions, use shared gradeMcq engine
    const selectedIndex = quizMcqOptionIndex(q.options, answers[q.id]);
    const correctIndex = quizMcqOptionIndex(q.options, q.correctAnswer);
    const grade = gradeMcq(selectedIndex, correctIndex, q.options, q.marks ?? 1);
    setShowFeedback(true);
    onQuestionAnswered?.(grade.status === "correct");
  };

  const handleReset = () => {
    setAnswers({});
    setShowFeedback(false);
    setLastGrade(null);
    setI(0);
    setIsQuizComplete(false);
    completeFiredRef.current = false;
    onQuizReset?.();
  };

  const finishQuiz = () => {
    setShowFeedback(false);
    setLastGrade(null);
    setIsQuizComplete(true);
    if (!completeFiredRef.current) {
      completeFiredRef.current = true;
      const graded = computeAutoGradableScore(questions, answers);
      onQuizComplete?.({
        questionCount: questions.length,
        questionIds: questions.map((qu) => String(qu.id)),
        score: graded.score,
        gradableCount: graded.gradableCount,
      });
    }
  };

  const toggleHelp = () => {
    setHelpExpanded(!helpExpanded);
  };

  const goPrev = () => {
    setShowFeedback(false);
    setLastGrade(null);
    setI((x) => Math.max(0, x - 1));
  };

  const goNext = () => {
    setShowFeedback(false);
    setLastGrade(null);
    setI((x) => Math.min(questions.length - 1, x + 1));
  };

  if (!questions?.length) {
    return (
      <div className="rounded-2xl border p-4">
        <div className="text-lg font-semibold">{title}</div>
        <div className="mt-2 text-sm opacity-70">No quiz questions yet.</div>
      </div>
    );
  }

  const isFirst = i === 0;
  const isLast = i === questions.length - 1;

  // End-of-quiz results screen
  if (isQuizComplete) {
    const answeredAny = Object.keys(answers).some((k) => String(answers[k] || "").trim());
    const totalGradableLive = liveGraded.gradableCount;
    const totalQuestions = questions.length;
    // Prefer live answers when present; otherwise restored payload (null score = legacy unknown).
    const scoreKnown = answeredAny
      ? true
      : restoredResult
        ? restoredResult.score != null
        : true;
    const totalCorrect = answeredAny
      ? liveGraded.score
      : restoredResult?.score != null
        ? restoredResult.score
        : liveGraded.score;
    const totalGradable = answeredAny
      ? totalGradableLive > 0
        ? totalGradableLive
        : totalQuestions
      : restoredResult?.questionCount && restoredResult.questionCount > 0
        ? restoredResult.questionCount
        : totalGradableLive > 0
          ? totalGradableLive
          : totalQuestions;
    const percentage =
      scoreKnown && totalGradable > 0
        ? Math.round((totalCorrect / totalGradable) * 100)
        : 0;
    const message =
      !scoreKnown
        ? null
        : percentage >= 80
          ? "Great work!"
          : percentage >= 50
            ? "Good effort."
            : "Review this topic again.";
    return (
      <div className="rounded-2xl border p-4">
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "6px 0 12px" }}>{title || "Quiz"}</h1>
        <div
          style={{
            marginTop: 20,
            padding: 24,
            borderRadius: 14,
            border: "2px solid #e5e7eb",
            background: "#ffffff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#111827",
              marginBottom: scoreKnown ? 16 : 24,
            }}
          >
            Quiz complete
          </div>
          {scoreKnown ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#2563eb", marginBottom: 4 }}>
                Score: {totalCorrect} / {totalGradable}
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b", marginBottom: 16 }}>
                {percentage}%
              </div>
              {message ? (
                <div style={{ fontSize: 15, fontWeight: 600, color: "#334155", marginBottom: 24 }}>
                  {message}
                </div>
              ) : null}
            </>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <button
              type="button"
              onClick={handleReset}
              data-testid="revision-try-again"
              style={{
                padding: "10px 18px",
                fontSize: 15,
                fontWeight: 700,
                background: "#2563eb",
                color: "#ffffff",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
              }}
            >
              Retry same quiz
            </button>
            {completeExtra ? <div data-testid="revision-fresh-cta-slot">{completeExtra}</div> : null}
            {onContinueLesson && (
              <button
                type="button"
                onClick={onContinueLesson}
                style={{
                  padding: "10px 18px",
                  fontSize: 15,
                  fontWeight: 700,
                  background: "#f1f5f9",
                  color: "#334155",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                }}
              >
                Continue lesson
              </button>
            )}
          </div>
          {scoreKnown ? (
            <RevisionQuizResultCard score={totalCorrect} questionCount={totalGradable} />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border p-4">
      {/* ✅ SS2: Bigger title */}
      <h1 style={{ fontSize: 28, fontWeight: 900, margin: "6px 0 12px" }}>
        {title}
      </h1>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm opacity-70">
            Question {i + 1} / {questions.length} • Score (auto-gradable): {score}
          </div>
        </div>

        {/* ✅ SS1: Improved navigation buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            disabled={isFirst}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: "#f1f5f9",
              color: "#334155",
              fontWeight: 600,
              cursor: isFirst ? "not-allowed" : "pointer",
              opacity: isFirst ? 0.5 : 1,
              transition: "all 0.2s ease",
            }}
            onClick={goPrev}
            onMouseEnter={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.borderColor = "#94a3b8";
              }
            }}
            onMouseLeave={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }
            }}
            onMouseDown={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "scale(0.98)";
              }
            }}
            onMouseUp={(e) => {
              if (!isFirst) {
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
          >
            ← Prev
          </button>

          <button
            type="button"
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              transition: "all 0.2s ease",
            }}
            onClick={isLast ? finishQuiz : goNext}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.backgroundColor = "#1d4ed8";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.backgroundColor = "#2563eb";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "scale(0.98)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
          >
            {isLast ? "Finish quiz" : "Next →"}
          </button>
        </div>
      </div>

      {/* Clear visual separation: guidance above, question block below */}
      <div
        style={{
          marginTop: 20,
          padding: 20,
          borderRadius: 14,
          border: "2px solid #e5e7eb",
          background: "#ffffff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: 8 }}>
          {q.type === "mcq" ? "Multiple choice" : q.type === "short" ? "Short answer" : "Exam-style"}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1.4, marginBottom: 4 }}>{q.question}</div>

        {q.type === "mcq" ? (
          !q.options || q.options.length === 0 ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #f59e0b",
                borderRadius: 8,
                background: "#fffbeb",
                color: "#92400e",
                fontSize: 14,
              }}
            >
              This multiple-choice question is missing options. Please ask your teacher to edit it.
            </div>
          ) : (
            <div className="mt-4 grid gap-2" style={{ display: "grid", gap: 12 }}>
              {(q.options || []).map((opt: string, idx: number) => {
                const optionStyle = getQuizMcqOptionStyle(showFeedback, mcqGrade, idx);
                const isSelected = answers[q.id] === opt;
                return (
                  <div
                    key={idx}
                    className="lr-mcq-option"
                    role="button"
                    tabIndex={0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: showFeedback ? "default" : "pointer",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: showFeedback
                        ? optionStyle.border
                        : isSelected
                          ? "2px solid #2563eb"
                          : "2px solid #e2e8f0",
                      background: showFeedback
                        ? optionStyle.background
                        : isSelected
                          ? "#eff6ff"
                          : "#fff",
                    }}
                    onClick={() => {
                      if (!showFeedback) setAnswers((a) => ({ ...a, [q.id]: opt }));
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !showFeedback) {
                        e.preventDefault();
                        setAnswers((a) => ({ ...a, [q.id]: opt }));
                      }
                    }}
                  >
                    <div
                      className="lr-mcq-text"
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 15,
                        fontWeight: 500,
                        color: "#374151",
                      }}
                    >
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
                        name={`q-${q.id}`}
                        value={opt}
                        checked={isSelected}
                        onChange={() => {
                          if (!showFeedback) setAnswers((a) => ({ ...a, [q.id]: opt }));
                        }}
                        disabled={showFeedback}
                        aria-label={opt}
                        style={{ width: 18, height: 18, accentColor: "#2563eb" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // ✅ SS2: More prominent answer input box
          <textarea
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            placeholder={q.type === "exam" ? "Write your answer..." : "Type your answer…"}
            style={{
              width: "100%",
              minHeight: 120,
              borderRadius: 14,
              border: "2px solid #2563eb",
              padding: 14,
              fontSize: 16,
              fontWeight: 700,
              outline: "none",
              background: "#ffffff",
              boxShadow: "0 6px 18px rgba(37, 99, 235, 0.12)",
              marginTop: "24px",
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              resize: "vertical",
            }}
          />
        )}

        {/* ✅ SS2: Cleaner difficulty/marks line (hidden for non-exam questions per SS1 suggestion) */}
        {q.type === "exam" ? (
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginTop: 8 }}>
            Difficulty: {q.difficulty ?? 1}/3 • Marks: {q.marks ?? 1}
          </div>
        ) : null}
        
        {/* Topic-bank questions: hide technical tags; no badge shown (UI cleanup) */}
        {(() => {
          const tags = q.tags ?? [];
          const hasTopicBank = tags.some(
            (t) =>
              t === "auto-attached" ||
              t === "topic-bank" ||
              (typeof t === "string" && t.includes(":"))
          );
          if (hasTopicBank) return null;
          if (tags.length > 0) {
            return (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {tags.map((t) => (
                  <span key={t} className="rounded-full border px-2 py-1 text-xs">
                    {t}
                  </span>
                ))}
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Primary action buttons — disable Check until MCQ has selection or short/exam has non-empty input */}
      {(() => {
        const currentAnswer = answers[q.id];
        const disableCheck =
          (q.type === "mcq" && !currentAnswer) ||
          (q.type === "short" && !String(currentAnswer ?? "").trim());
        return (
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button
              type="button"
              onClick={handleCheck}
              disabled={disableCheck}
              style={{
                padding: "10px 18px",
                fontSize: 16,
                fontWeight: 800,
                background: disableCheck ? "#94a3b8" : "#2563eb",
                color: "#ffffff",
                borderRadius: 10,
                border: "none",
                cursor: disableCheck ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                if (disableCheck) return;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.backgroundColor = "#1d4ed8";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.backgroundColor = disableCheck ? "#94a3b8" : "#2563eb";
                e.currentTarget.style.boxShadow = "0 6px 18px rgba(37, 99, 235, 0.12)";
              }}
              onMouseDown={(e) => {
                if (disableCheck) return;
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                if (disableCheck) return;
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
            >
              Check answer
            </button>

            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 700,
                background: "#f1f5f9",
                color: "#0f172a",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.backgroundColor = "#e2e8f0";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.backgroundColor = "#f1f5f9";
                e.currentTarget.style.boxShadow = "none";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
            >
              Reset
            </button>
          </div>
        );
      })()}

      {/* Marking feedback display */}
      {showFeedback && lastGrade && (q.type === "short" || q.type === "exam") ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: lastGrade.contradictionFeedback ? "1px solid rgba(239,68,68,0.35)" : "1px solid #e5e7eb",
            background: lastGrade.contradictionFeedback ? "rgba(254,226,226,0.5)" : "#f8fafc",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            Score: {lastGrade.score}/{lastGrade.maxMarks}
          </div>

          {lastGrade.contradictionFeedback ? (
            <div style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>
              {lastGrade.contradictionFeedback}
            </div>
          ) : Array.isArray(lastGrade.hits) && lastGrade.hits.length ? (
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
              <span style={{ color: "#059669", marginRight: 4 }}>✔</span>
              Matched: {lastGrade.hits.join(", ")}
            </div>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
              No mark-scheme points matched yet.
            </div>
          )}
        </div>
      ) : null}

      {showFeedback && q.type === "mcq" && mcqGrade && mcqFeedback ? (
        <>
          <AnswerFeedbackPanel
            layout="mcq"
            status={mcqGrade.status}
            marksAwarded={mcqGrade.marksAwarded}
            totalMarks={mcqGrade.totalMarks}
            yourAnswer={formatQuizMcqAnswerLine(mcqGrade, mcqSelectedAnswer)}
            correctAnswer={
              mcqGrade.correctLabel && mcqGrade.correctOption
                ? `${mcqGrade.correctLabel} — ${mcqGrade.correctOption}`
                : mcqCorrectAnswer
            }
            markScheme={mcqMarkSchemeLines}
            mcqFeedback={mcqFeedback}
            improvementTip={mcqFeedback.improvementTip}
          />
          {mcqGrade.status === "incorrect" && (q.question || "").trim() && mcqCorrectAnswer ? (
            <div className="mt-3">
              <ExplainMyMistakeButton
                questionText={(q.question || "").slice(0, 2000)}
                userAnswer={mcqSelectedAnswer || "No answer given."}
                correctAnswer={mcqCorrectAnswer}
              />
            </div>
          ) : null}
        </>
      ) : showFeedback && q.type === "mcq" && !mcqGrade ? (
        <div style={{ marginTop: 12, color: "#374151", fontSize: 14 }}>
          Could not mark this question — the correct option is missing from the quiz data.
        </div>
      ) : null}

      {showFeedback && q.type !== "mcq" ? (
        <div className="mt-4 rounded-2xl border p-4">
          <div className="text-sm font-semibold">Feedback</div>

          {q.type === "short" ? (
            (q.correctAnswer ?? "").trim() ? (
              <div className="mt-2 text-sm">
                <div className="opacity-70">Suggested answer:</div>
                <div className="mt-1 font-medium">{q.correctAnswer}</div>
              </div>
            ) : null
          ) : (
            <div className="mt-2 text-sm">
              <div className="opacity-70">Mark scheme points:</div>
              <ul className="mt-2 list-disc pl-5">
                {(q.markScheme ?? []).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {q.explanation ? <div className="mt-3 text-sm opacity-80">{q.explanation}</div> : null}

          {(() => {
            const userAns = (answers[q.id] ?? "").trim();
            const correctAns = (
              q.type === "exam" ? (q.markScheme ?? []).join("\n") || (q.correctAnswer ?? "") : (q.correctAnswer ?? "")
            ).trim();
            const isWrongShortExam =
              (q.type === "short" || q.type === "exam") && lastGrade != null && lastGrade.score < lastGrade.maxMarks;
            if (!isWrongShortExam || !(q.question || "").trim() || !correctAns) return null;
            return (
              <div className="mt-3">
                <ExplainMyMistakeButton
                  questionText={(q.question || "").slice(0, 2000)}
                  userAnswer={userAns || "No answer given."}
                  correctAnswer={correctAns}
                  markScheme={q.type === "exam" ? q.markScheme : undefined}
                />
              </div>
            );
          })()}
        </div>
      ) : null}

      {/* How quiz marking works — moved below question so it doesn't dominate; collapsed by default */}
      <div
        style={{
          marginTop: 24,
          padding: "10px 14px",
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          fontSize: 13,
          fontWeight: 600,
          color: "#334155",
          lineHeight: 1.5,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            marginBottom: helpExpanded ? 8 : 0,
          }}
          onClick={toggleHelp}
        >
          <div style={{ fontWeight: 900 }}>How quiz marking works</div>
          <div style={{ fontSize: 12, color: "#64748b", userSelect: "none" }}>
            {helpExpanded ? "▾" : "▸"}
          </div>
        </div>

        {helpExpanded && (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                <span style={{ marginRight: 6 }}>🧠</span> How to answer quiz questions
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Read the question carefully and identify the command word
                <br />
                (e.g. state, describe, explain, compare)
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Use precise scientific vocabulary and correct spelling
              </div>
              <div style={{ fontSize: 12.5 }}>
                If a question is worth more than 1 mark, make more than one distinct point
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                <span style={{ marginRight: 6 }}>✍️</span> Short-answer questions
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Write in clear, complete sentences
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Avoid vague phrases like "it helps" or "it does stuff"
              </div>
              <div style={{ fontSize: 12.5 }}>
                <span style={{ color: "#059669", fontWeight: 800 }}>✅</span> "Controls the cell's activities"
                <br />
                <span style={{ color: "#dc2626", fontWeight: 800 }}>❌</span> "Controls the cell"
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                <span style={{ marginRight: 6 }}>✅</span> How marking works
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Marks are awarded for scientifically correct points, not exact wording
              </div>
              <div style={{ fontSize: 12.5, marginBottom: 4 }}>
                Partial marks are given for partially correct answers
              </div>
              <div style={{ fontSize: 12.5 }}>
                Feedback shows:
                <br />
                <span style={{ color: "#059669", fontWeight: 800 }}>✔</span> What was credited
                <br />
                <span style={{ color: "#dc2626", fontWeight: 800 }}>✖</span> What was missing
              </div>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />

            <div style={{ fontSize: 12.5, fontStyle: "italic", paddingTop: 4 }}>
              <strong>Exam tip:</strong>
              If a question is worth 2 marks or more, aim to make 2 clear, separate points.
            </div>
          </>
        )}
      </div>
    </div>
  );
}