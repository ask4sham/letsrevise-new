// frontend/src/quizzes/TestYourKnowledge.tsx
import React, { useEffect, useState } from "react";

// ✅ Define the actual Question type from your Lesson type
type ActualQuestion = {
  id: string;
  type: "mcq" | "short" | "exam";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  tags?: string[];
  difficulty?: number;
  marks?: number;
  markScheme?: string[];
};

// ✅ Keep the old QuizQuestion type for external quizzes
type QuizQuestion = {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

type Quiz = {
  id: string;
  title: string;
  description?: string | null;
  level?: string | null;
  subject?: string | null;
  exam_board?: string | null;
  module?: string | null;
  questions: QuizQuestion[];
};

// ✅ Update LessonLike to match actual Lesson structure
type LessonLike = {
  level?: string;
  subject?: string;
  topic?: string;
  examBoardName?: string | null;
  quiz?: {
    timeSeconds?: number;
    questions?: ActualQuestion[];
  };
  [key: string]: any;
};

interface Props {
  lesson: LessonLike | null;
}

// ✅ Helper to convert ActualQuestion to QuizQuestion for display
const convertToQuizQuestion = (actualQuestion: ActualQuestion): QuizQuestion => {
  // For MCQ questions, parse correctAnswer to get correctIndex
  let correctIndex = 0;
  if (actualQuestion.type === "mcq" && actualQuestion.options && actualQuestion.options.length > 0) {
    // Try to parse correctAnswer as index or find matching option
    const index = parseInt(actualQuestion.correctAnswer, 10);
    if (!isNaN(index) && index >= 0 && index < actualQuestion.options.length) {
      correctIndex = index;
    } else {
      // Fallback: find index of matching option text
      const foundIndex = actualQuestion.options.findIndex(
        option => option.trim().toLowerCase() === actualQuestion.correctAnswer.trim().toLowerCase()
      );
      if (foundIndex >= 0) {
        correctIndex = foundIndex;
      }
    }
  }

  return {
    questionText: actualQuestion.question,
    options: actualQuestion.options || [],
    correctIndex,
    explanation: actualQuestion.explanation
  };
};

// ✅ Use the same env pattern as the rest of the app (and avoid trailing slashes)
const RAW_API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

function getAuthToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

const TestYourKnowledge: React.FC<Props> = ({ lesson }) => {
  // ✅ SINGLE SOURCE OF TRUTH: Get questions from lesson.quiz
  const lessonQuestions = lesson?.quiz?.questions ?? [];
  
  // ✅ Convert lesson questions to display format if needed
  const displayQuestions = lessonQuestions.length > 0 
    ? lessonQuestions.map(convertToQuizQuestion)
    : [];
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Taking-quiz state - now using displayQuestions if available
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [numCorrect, setNumCorrect] = useState(0);

  // ✅ Use lesson's questions if we have them, otherwise use external quizzes
  const useLessonQuiz = displayQuestions.length > 0;
  
  // If using lesson quiz, create a mock quiz object
  const lessonQuiz: Quiz = {
    id: 'lesson-quiz',
    title: 'Lesson Quiz',
    description: 'Quiz from this lesson',
    level: lesson?.level || null,
    subject: lesson?.subject || null,
    exam_board: lesson?.examBoardName || null,
    module: lesson?.topic || null,
    questions: displayQuestions
  };

  const activeQuiz = useLessonQuiz 
    ? lessonQuiz 
    : quizzes.find((q) => q.id === activeQuizId) || null;
    
  const totalQuestions = activeQuiz?.questions?.length || 0;
  const currentQuestion =
    activeQuiz && activeQuiz.questions[currentIndex]
      ? activeQuiz.questions[currentIndex]
      : null;

  // Raw display values from lesson
  const displayLevel = lesson?.level || "";
  const displaySubject = lesson?.subject || "";
  const displayExamBoard = lesson?.examBoardName || "";
  const displayTopic = lesson?.topic || "Not set";

  // ✅ Normalised keys used for API query (only if we need external quizzes)
  const levelKey = displayLevel.toLowerCase();

  const subjectKey = (() => {
    const s = displaySubject.toLowerCase();
    if (s.startsWith("math")) return "maths";
    return s;
  })();

  const boardKey = displayExamBoard.toLowerCase() || undefined;

  const moduleKey =
    displayTopic && displayTopic !== "Not set"
      ? displayTopic.toLowerCase()
      : undefined;

  useEffect(() => {
    // Only fetch external quizzes if lesson has no questions
    if (useLessonQuiz || !levelKey || !subjectKey || !boardKey) {
      return;
    }

    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append("level", levelKey);
        params.append("subject", subjectKey);
        params.append("exam_board", boardKey);
        params.append("is_published", "true");
        if (moduleKey) params.append("module", moduleKey);

        const url = `${API_BASE}/api/quizzes?${params.toString()}`;
        console.log("[TestYourKnowledge] Fetching:", url);

        const res = await fetch(url);
        const text = await res.text();
        console.log("[TestYourKnowledge] Raw response:", text);

        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("Unexpected response from server (not valid JSON).");
        }

        if (!res.ok) {
          throw new Error(json.error || "Failed to load quizzes");
        }

        setQuizzes(json.quizzes || []);
      } catch (err: any) {
        console.error("Failed to load quizzes for lesson:", err);
        setError(err.message || "Something went wrong loading quizzes");
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [levelKey, subjectKey, boardKey, moduleKey, useLessonQuiz]);

  // If we don't even know level/subject/board, don't show block
  if (!displayLevel || !displaySubject || !displayExamBoard) {
    return null;
  }

  // ✅ Check lesson's own quiz questions first
  if (lessonQuestions.length === 0) {
    return (
      <section
        style={{
          marginTop: "2rem",
          padding: "1.5rem",
          borderRadius: "12px",
          border: "1px solid #e0e0e0",
          background: "#fafafa",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "0.5rem", textAlign: "center" }}>
          Test your knowledge
        </h2>
        <p
          style={{
            marginTop: 0,
            fontSize: "0.9rem",
            color: "#555",
            textAlign: "center",
          }}
        >
          Topic: <strong>{displayTopic}</strong> · {displayLevel.toUpperCase()}{" "}
          {displaySubject.toUpperCase()}{" "}
          {displayExamBoard ? `(${displayExamBoard.toUpperCase()})` : null}
        </p>
        <p style={{ fontSize: "0.9rem" }}>No quizzes available for this lesson yet.</p>
      </section>
    );
  }

  const startQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setCurrentIndex(0);
    setAnswers(totalQuestions > 0 ? new Array(totalQuestions).fill(-1) : []);
    setShowAnswer(false);
    setFinished(false);
    setNumCorrect(0);
  };

  const handleOptionClick = (idx: number) => {
    if (!activeQuiz || !currentQuestion) return;

    setAnswers((prev) => {
      const copy = [...prev];
      if (currentIndex < copy.length) {
        copy[currentIndex] = idx;
      }
      return copy;
    });
    setShowAnswer(false);
  };

  const handleCheckAnswer = () => {
    if (!currentQuestion) return;
    setShowAnswer(true);
  };

  const saveAttempt = async (correct: number, total: number) => {
    if (!activeQuiz) return;

    try {
      const token = getAuthToken();

      const res = await fetch(`${API_BASE}/api/quizzes/${activeQuiz.id}/attempt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          total_questions: total,
          correct_answers: correct,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Failed to save quiz attempt:", res.status, text);
      }
    } catch (err) {
      console.error("Failed to save quiz attempt:", err);
    }
  };

  const handleNext = () => {
    if (!activeQuiz) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= activeQuiz.questions.length) {
      const correctCount = activeQuiz.questions.reduce((acc, q, i) => {
        return acc + (answers[i] === q.correctIndex ? 1 : 0);
      }, 0);

      setNumCorrect(correctCount);
      setFinished(true);
      setShowAnswer(false);

      saveAttempt(correctCount, activeQuiz.questions.length);
      return;
    }

    setCurrentIndex(nextIndex);
    setShowAnswer(false);
  };

  const handleRestart = () => {
    if (!activeQuiz) return;
    const length = activeQuiz.questions.length;
    setCurrentIndex(0);
    setAnswers(length > 0 ? new Array(length).fill(-1) : []);
    setShowAnswer(false);
    setFinished(false);
    setNumCorrect(0);
  };

  return (
    <section
      style={{
        marginTop: "2rem",
        padding: "1.5rem",
        borderRadius: "12px",
        border: "1px solid #e0e0e0",
        background: "#fafafa",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "0.5rem", textAlign: "center" }}>
        Test your knowledge
      </h2>
      <p
        style={{
          marginTop: 0,
          fontSize: "0.9rem",
          color: "#555",
          textAlign: "center",
        }}
      >
        Topic: <strong>{displayTopic}</strong> · {displayLevel.toUpperCase()}{" "}
        {displaySubject.toUpperCase()}{" "}
        {displayExamBoard ? `(${displayExamBoard.toUpperCase()})` : null}
      </p>

      {loading && !useLessonQuiz && <p>Loading quizzes…</p>}

      {error && !loading && (
        <p style={{ color: "red", fontSize: "0.9rem" }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          {useLessonQuiz ? (
            // ✅ Show lesson quiz button
            <div style={{ marginBottom: "1rem" }}>
              <button
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "999px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  background: "#667eea",
                  color: "white",
                }}
                onClick={() => startQuiz('lesson-quiz')}
              >
                Start Lesson Quiz ({displayQuestions.length} questions)
              </button>
            </div>
          ) : (
            // Show external quizzes list
            <ul
              style={{
                listStyle: "none",
                paddingLeft: 0,
                marginBottom: "1rem",
              }}
            >
              {quizzes.map((quiz) => (
                <li
                  key={quiz.id}
                  style={{
                    padding: "0.75rem 0",
                    borderBottom: "1px solid #e6e6e6",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{quiz.title}</div>
                    {quiz.description && (
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>
                        {quiz.description}
                      </div>
                    )}
                  </div>
                  <button
                    style={{
                      padding: "0.4rem 0.9rem",
                      borderRadius: "999px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      background: "#667eea",
                      color: "white",
                    }}
                    onClick={() => startQuiz(quiz.id)}
                  >
                    Start quiz
                  </button>
                </li>
              ))}
            </ul>
          )}

          {activeQuiz && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem 1.25rem",
                borderRadius: "12px",
                background: "#ffffff",
                border: "1px solid #ddd",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: "1rem" }}>{activeQuiz.title}</h3>

              {totalQuestions > 0 && (
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: "0.5rem",
                    fontSize: "0.85rem",
                    color: "#666",
                  }}
                >
                  Question {Math.min(currentIndex + 1, totalQuestions)} of{" "}
                  {totalQuestions}
                </p>
              )}

              {finished ? (
                <>
                  <p style={{ marginBottom: "0.75rem" }}>
                    You answered{" "}
                    <strong>
                      {numCorrect} / {totalQuestions}
                    </strong>{" "}
                    correctly.
                  </p>
                  <button
                    style={{
                      padding: "0.4rem 0.9rem",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      marginRight: "0.5rem",
                      background: "#48bb78",
                      color: "white",
                    }}
                    onClick={handleRestart}
                  >
                    Try again
                  </button>
                  <button
                    style={{
                      padding: "0.4rem 0.9rem",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setActiveQuizId(null);
                      setFinished(false);
                      setShowAnswer(false);
                    }}
                  >
                    Close
                  </button>
                </>
              ) : currentQuestion ? (
                <>
                  <p style={{ marginBottom: "0.75rem" }}>
                    {currentQuestion.questionText}
                  </p>

                  <div>
                    {currentQuestion.options.map((opt, idx) => {
                      const selectedIndex = answers[currentIndex];
                      const isSelected = selectedIndex === idx;
                      const isCorrect = currentQuestion.correctIndex === idx;

                      let background = "white";
                      let borderColor = "#cbd5e0";

                      if (isSelected && !showAnswer) {
                        background = "#ebf4ff";
                        borderColor = "#667eea";
                      } else if (showAnswer && isCorrect) {
                        background = "#d4edda";
                        borderColor = "#38a169";
                      } else if (showAnswer && isSelected && !isCorrect) {
                        background = "#f8d7da";
                        borderColor = "#e53e3e";
                      }

                      return (
                        <label
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "0.5rem",
                            padding: "0.6rem 0.75rem",
                            borderRadius: "8px",
                            border: `1px solid ${borderColor}`,
                            background,
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                          }}
                          onClick={() => handleOptionClick(idx)}
                        >
                          <span
                            style={{
                              width: "16px",
                              height: "16px",
                              borderRadius: "50%",
                              border: isSelected
                                ? "5px solid #667eea"
                                : "2px solid #a0aec0",
                              boxSizing: "border-box",
                              flexShrink: 0,
                              background: "white",
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: "0.75rem",
                      display: "flex",
                      gap: "0.5rem",
                    }}
                  >
                    <button
                      style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background:
                          answers[currentIndex] === -1 ? "#cbd5e0" : "#3182ce",
                        color: "white",
                      }}
                      onClick={handleCheckAnswer}
                      disabled={answers[currentIndex] === -1}
                    >
                      Check answer
                    </button>
                    <button
                      style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                      onClick={handleNext}
                      disabled={!showAnswer}
                    >
                      {currentIndex + 1 === totalQuestions ? "Finish" : "Next question"}
                    </button>
                    <button
                      style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setActiveQuizId(null);
                        setShowAnswer(false);
                        setFinished(false);
                      }}
                    >
                      Close
                    </button>
                  </div>

                  {showAnswer && currentQuestion.explanation && (
                    <p
                      style={{
                        marginTop: "0.75rem",
                        fontSize: "0.9rem",
                        color: "#555",
                      }}
                    >
                      Explanation: {currentQuestion.explanation}
                    </p>
                  )}
                </>
              ) : (
                <p>No questions in this quiz yet.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TestYourKnowledge;