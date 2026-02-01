import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../services/api";

type QuestionResult = {
  _id: string;
  title: string;
  question: string;
  type: string;
  options: string[];
  marks: number;
  correctIndex?: number;
  correctAnswer?: string | null;
  explanation?: string;
  userAnswer:
    | {
        selectedIndex?: number | null;
        textAnswer?: string | null;
        answeredAt: string;
      }
    | null;
  isCorrect: boolean;
};

type AssessmentAttempt = {
  _id: string;
  paperId: {
    _id: string;
    title: string;
    subject: string;
    examBoard?: string;
    level?: string;
    tier?: string;
    kind?: string;
    timeSeconds?: number;
  };
  status: string;
  startedAt: string;
  submittedAt?: string;
  durationSeconds: number;
  timeUsedSeconds: number;
  autoSubmitted: boolean;
  score: {
    totalQuestions: number;
    answered: number;
    correct: number;
    percentage: number;
  };
};

type AssessmentPaper = {
  _id: string;
  title: string;
  subject: string;
  examBoard?: string;
  level?: string;
  tier?: string;
  kind?: string;
  timeSeconds?: number;
};

const AssessmentPaperResultsPage: React.FC = () => {
  const { id: paperId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get("attemptId");

  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [paper, setPaper] = useState<AssessmentPaper | null>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId || !paperId) return;

    const loadResults = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get(`/assessment-attempts/${attemptId}/results`);
        const data = response.data;

        setAttempt(data.attempt);
        setPaper(data.paper);
        setQuestionResults(data.questionResults || []);
      } catch (err: any) {
        console.error("Error loading results:", err);
        setError(err.response?.data?.msg || "Failed to load results. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [attemptId, paperId]);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Loading results...</h2>
        <p>Please wait while we calculate your score</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
        <h2>Error</h2>
        <p style={{ color: "#dc2626" }}>{error}</p>
        <Link to={`/assessments/papers/${paperId}/start`}>Back to Paper</Link>
      </div>
    );
  }

  if (!attempt || !paper) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Results not found</h2>
        <Link to={`/assessments/papers/${paperId}/start`}>Back to Paper</Link>
      </div>
    );
  }

  const score = attempt.score;
  const percentage = score.percentage || 0;
  const isPassing = percentage >= 70;

  return (
    <div style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <Link
          to={`/assessments/papers/${paperId}/start`}
          style={{
            textDecoration: "none",
            color: "#2563eb",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <span>←</span> Back to Paper Overview
        </Link>

        <h1 style={{ marginBottom: "0.5rem" }}>{paper.title} - Results</h1>
        <div style={{ opacity: 0.7, fontSize: "0.95rem" }}>
          {paper.subject} • {paper.examBoard} • {paper.level}
        </div>
      </div>

      {/* Score Summary */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "14px",
          padding: "2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          border: "1px solid #e5e7eb",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Your Performance</h2>

        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          {/* Percentage Circle */}
          <div style={{ position: "relative", width: "120px", height: "120px" }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={isPassing ? "#10b981" : "#ef4444"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 3.39} 340`}
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a" }}>
                {percentage}%
              </div>
              <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
                Score
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "1.5rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.25rem" }}>
                  Total Questions
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a" }}>
                  {score.totalQuestions}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.25rem" }}>
                  Answered
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a" }}>
                  {score.answered}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.25rem" }}>
                  Correct
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a" }}>
                  {score.correct}
                </div>
              </div>
            </div>

            {/* Time Info */}
            <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    Started
                  </div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>
                    {new Date(attempt.startedAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    Submitted
                  </div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>
                    {attempt.submittedAt
                      ? new Date(attempt.submittedAt).toLocaleString()
                      : "Not submitted"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.25rem" }}>
                    Time Used
                  </div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>
                    {Math.floor(attempt.timeUsedSeconds / 60)}:
                    {(attempt.timeUsedSeconds % 60).toString().padStart(2, "0")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Question-by-Question Review */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1.5rem" }}>Question Review</h2>

        {questionResults.length === 0 ? (
          <div
            style={{
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              padding: "2rem",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            No question results available.
          </div>
        ) : (
          questionResults.map((question, index) => {
            // Determine if question has an answer (different logic for short vs MCQ)
            const isShort = question.type === "short";
            
            const hasAnswer = isShort
              ? !!question.userAnswer?.textAnswer && question.userAnswer.textAnswer.trim() !== ""
              : question.userAnswer?.selectedIndex !== null && question.userAnswer?.selectedIndex !== undefined;
            
            const selectedIndex = !isShort ? question.userAnswer?.selectedIndex : undefined;
            const userTextAnswer = isShort ? question.userAnswer?.textAnswer ?? "" : "";

            // Your answer / correct answer text: short = raw text; MCQ = "Label: option text"
            const correctAnswerText = question.type === "short"
              ? question.correctAnswer || "—"
              : (() => {
                  const ci = question.correctIndex as number;
                  if (ci >= 0 && question.options?.[ci] != null) {
                    const label = ci < 26 ? String.fromCharCode(65 + ci) : `Option ${ci + 1}`;
                    return `${label}: ${question.options[ci]}`;
                  }
                  return question.correctAnswer ?? "—";
                })();
            const yourAnswerTextMcq =
              hasAnswer && typeof selectedIndex === "number" && question.options
                ? (() => {
                    const opt = question.options[selectedIndex];
                    const label = selectedIndex >= 0 && selectedIndex < 26 ? String.fromCharCode(65 + selectedIndex) : `Option ${selectedIndex + 1}`;
                    return opt != null ? `${label}: ${opt}` : `Option ${selectedIndex + 1}`;
                  })()
                : "Not answered";

            return (
              <div
                key={question._id || index}
                style={{
                  backgroundColor: "white",
                  borderRadius: "14px",
                  padding: "2rem",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                  border: "1px solid #e5e7eb",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}>
                      Question {index + 1}: {question.title}
                    </h3>
                    <div style={{ marginTop: "0.5rem", fontSize: "1.1rem", color: "#0f172a", fontWeight: 600 }}>
                      {question.question}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "0.35rem 0.75rem",
                      backgroundColor: question.isCorrect ? "#d1fae5" : "#fee2e2",
                      color: question.isCorrect ? "#065f46" : "#991b1b",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      fontWeight: 800,
                      border: `1px solid ${question.isCorrect ? "#a7f3d0" : "#fecaca"}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {question.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                    <span style={{ marginLeft: "0.5rem" }}>
                      ({question.marks} mark{question.marks !== 1 ? "s" : ""})
                    </span>
                  </div>
                </div>

                {/* Question type indicator */}
                <div
                  style={{
                    display: "inline-block",
                    padding: "0.25rem 0.75rem",
                    backgroundColor: "#f1f5f9",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#475569",
                    marginBottom: "1rem",
                    textTransform: "uppercase",
                  }}
                >
                  {question.type}
                </div>

                {/* Your answer */}
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.5rem", fontWeight: 700 }}>
                    Your answer
                  </div>
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: hasAnswer ? "#f8fafc" : "#fef2f2",
                      borderRadius: "8px",
                      border: `1px solid ${hasAnswer ? "#e2e8f0" : "#fecaca"}`,
                      minHeight: "3rem",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {isShort
                      ? (hasAnswer ? userTextAnswer : "Not answered")
                      : yourAnswerTextMcq}
                  </div>
                </div>

                {/* Correct answer: always show for short (model answer); for MCQ always show when options + correctIndex */}
                {((question.type === "short" && question.correctAnswer != null) ||
                  (question.type === "mcq" && question.correctIndex !== undefined && question.correctIndex !== null && Array.isArray(question.options)) ||
                  (question.type !== "short" && question.type !== "mcq" && (question.correctAnswer || (question.correctIndex !== undefined && question.correctIndex !== null)))) && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.5rem", fontWeight: 700 }}>
                      Correct answer
                    </div>
                    <div
                      style={{
                        padding: "1rem",
                        backgroundColor: "#f0fdf4",
                        borderRadius: "8px",
                        border: "1px solid #bbf7d0",
                        minHeight: "3rem",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#065f46", whiteSpace: "pre-wrap" }}>
                        {correctAnswerText}
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanation if available */}
                {question.explanation && (
                  <div style={{ marginTop: "1rem" }}>
                    <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.5rem", fontWeight: 700 }}>
                      Explanation
                    </div>
                    <div
                      style={{
                        padding: "1rem",
                        backgroundColor: "#f8fafc",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        color: "#475569",
                        fontSize: "0.95rem",
                        lineHeight: 1.6,
                      }}
                    >
                      {question.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "1.5rem",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <Link
          to={`/assessments/papers/${paperId}/start`}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#2563eb",
            color: "white",
            textDecoration: "none",
            borderRadius: "10px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "inline-block",
          }}
        >
          Return to Paper Overview
        </Link>

        <Link
          to={`/assessments/papers/${paperId}/attempt?attemptId=${attemptId}`}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "white",
            color: "#2563eb",
            textDecoration: "none",
            borderRadius: "10px",
            fontWeight: 700,
            border: "2px solid #2563eb",
            cursor: "pointer",
            display: "inline-block",
          }}
        >
          Review Attempt
        </Link>
      </div>
    </div>
  );
};

export default AssessmentPaperResultsPage;