import React, { useEffect, useState } from "react";

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

type LessonLike = {
  level?: string;
  subject?: string;
  exam_board?: string;
  examBoard?: string;
  module?: string;
  moduleName?: string;
  [key: string]: any;
};

interface Props {
  lesson: LessonLike | null;
}

const TestYourKnowledge: React.FC<Props> = ({ lesson }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Very simple local “taking quiz” state
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(
    null
  );
  const [showAnswer, setShowAnswer] = useState(false);

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId);
  const firstQuestion = activeQuiz?.questions?.[0];

  // If we don’t have lesson metadata, we can’t match quizzes
  const level = lesson?.level;
  const subject = lesson?.subject;
  const examBoard = (lesson as any)?.exam_board || (lesson as any)?.examBoard;
  const module =
    (lesson as any)?.module || (lesson as any)?.moduleName || undefined;

  useEffect(() => {
    // Only try to fetch if we have enough info to match
    if (!level || !subject || !examBoard || !module) {
      return;
    }

    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.append("level", level);
        params.append("subject", subject);
        params.append("exam_board", examBoard);
        params.append("module", module);
        params.append("is_published", "true");

        const res = await fetch(`/api/quizzes?${params.toString()}`);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load quizzes");
        }

        const json = await res.json();
        setQuizzes(json.quizzes || []);
      } catch (err: any) {
        console.error("Failed to load quizzes for lesson:", err);
        setError(err.message || "Something went wrong loading quizzes");
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [level, subject, examBoard, module]);

  // If we don’t have enough metadata, don’t show the block at all
  if (!level || !subject || !examBoard || !module) {
    return null;
  }

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
      <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
        Test your knowledge
      </h2>
      <p style={{ marginTop: 0, fontSize: "0.9rem", color: "#555" }}>
        Topic: <strong>{module}</strong> · {level.toUpperCase()}{" "}
        {subject.toUpperCase()} ({examBoard.toUpperCase()})
      </p>

      {loading && <p>Loading quizzes…</p>}

      {error && !loading && (
        <p style={{ color: "red", fontSize: "0.9rem" }}>{error}</p>
      )}

      {!loading && !error && quizzes.length === 0 && (
        <p style={{ fontSize: "0.9rem" }}>
          No quizzes available for this lesson yet.
        </p>
      )}

      {!loading && !error && quizzes.length > 0 && (
        <>
          <ul style={{ listStyle: "none", paddingLeft: 0, marginBottom: "1rem" }}>
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
                    padding: "0.4rem 0.8rem",
                    borderRadius: "999px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                  onClick={() => {
                    setActiveQuizId(quiz.id);
                    setSelectedOptionIndex(null);
                    setShowAnswer(false);
                  }}
                >
                  Quick question
                </button>
              </li>
            ))}
          </ul>

          {activeQuiz && firstQuestion && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                borderRadius: "10px",
                background: "#ffffff",
                border: "1px solid #ddd",
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: "1rem" }}>
                Sample question from “{activeQuiz.title}”
              </h3>
              <p style={{ marginBottom: "0.75rem" }}>{firstQuestion.questionText}</p>

              <div>
                {firstQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOptionIndex === idx;
                  const isCorrect = firstQuestion.correctIndex === idx;

                  let background = "#f5f5f5";
                  if (showAnswer && isCorrect) background = "#d4edda";
                  else if (showAnswer && isSelected && !isCorrect)
                    background = "#f8d7da";

                  return (
                    <button
                      key={idx}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        marginBottom: "0.5rem",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        background,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setSelectedOptionIndex(idx);
                        setShowAnswer(false);
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                <button
                  style={{
                    padding: "0.4rem 0.8rem",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowAnswer(true)}
                  disabled={selectedOptionIndex === null}
                >
                  Check answer
                </button>
                <button
                  style={{
                    padding: "0.4rem 0.8rem",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setActiveQuizId(null);
                    setSelectedOptionIndex(null);
                    setShowAnswer(false);
                  }}
                >
                  Close
                </button>
              </div>

              {showAnswer && firstQuestion.explanation && (
                <p
                  style={{
                    marginTop: "0.75rem",
                    fontSize: "0.9rem",
                    color: "#555",
                  }}
                >
                  Explanation: {firstQuestion.explanation}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TestYourKnowledge;
