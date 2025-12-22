import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

type QuizQuestion = {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

const emptyQuestion = (): QuizQuestion => ({
  questionText: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
});

const CreateQuizPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [level, setLevel] = useState<"gcse" | "a-level" | "ks3" | "">("");
  const [subject, setSubject] = useState<string>("");
  const [examBoard, setExamBoard] = useState<string>("");
  const [module, setModule] = useState<string>("");

  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleQuestionChange = (
    index: number,
    field: keyof QuizQuestion,
    value: string | number
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              [field]: value,
            }
          : q
      )
    );
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== questionIndex) return q;
        const newOptions = [...q.options];
        newOptions[optionIndex] = value;
        return { ...q, options: newOptions };
      })
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string[] => {
    const errors: string[] = [];

    if (!title.trim()) errors.push("Title is required.");
    if (!level) errors.push("Level is required.");
    if (!subject) errors.push("Subject is required.");
    if (!examBoard) errors.push("Exam board is required.");
    if (!module.trim()) errors.push("Module / topic is required.");

    if (questions.length === 0) {
      errors.push("At least one question is required.");
    }

    questions.forEach((q, index) => {
      if (!q.questionText.trim()) {
        errors.push(`Question ${index + 1}: text is required.`);
      }

      const filledOptions = q.options.filter((o) => o.trim() !== "");
      if (filledOptions.length < 2) {
        errors.push(`Question ${index + 1}: at least 2 options are required.`);
      }

      if (
        typeof q.correctIndex !== "number" ||
        q.correctIndex < 0 ||
        q.correctIndex >= q.options.length
      ) {
        errors.push(
          `Question ${index + 1}: correct answer must be one of the options.`
        );
      }
    });

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(" "));
      return;
    }

    try {
      setSubmitting(true);

      // Filter out any completely empty options to keep things clean
      const cleanedQuestions: QuizQuestion[] = questions.map((q) => {
        const nonEmptyOptions = q.options.filter((o) => o.trim() !== "");
        let correctedIndex = q.correctIndex;

        // If correctIndex points at an empty option, just default to 0
        if (correctedIndex >= nonEmptyOptions.length) {
          correctedIndex = 0;
        }

        return {
          questionText: q.questionText.trim(),
          options: nonEmptyOptions,
          correctIndex: correctedIndex,
          explanation: q.explanation?.trim() || undefined,
        };
      });

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      await axios.post(
        "http://localhost:5000/api/quizzes",
        {
          title: title.trim(),
          description: description.trim() || null,
          level,
          subject, // already normalised (e.g. "maths")
          exam_board: examBoard, // e.g. "aqa"
          module: module.trim().toLowerCase(), // "algebra"
          questions: cleanedQuestions,
          is_published: true,
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      setSuccessMessage("Quiz created successfully!");
      // Reset most of the form but keep metadata to allow another quiz quickly
      setTitle("");
      setDescription("");
      setQuestions([emptyQuestion()]);
    } catch (err: any) {
      console.error("Failed to create quiz:", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.msg ||
        err?.message ||
        "Failed to create quiz.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    navigate("/teacher-dashboard");
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <button
        onClick={goBack}
        style={{
          marginBottom: "16px",
          background: "none",
          border: "none",
          color: "#667eea",
          cursor: "pointer",
          padding: 0,
        }}
      >
        ← Back to Dashboard
      </button>

      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "8px" }}>Create Quiz</h1>
        <p style={{ marginTop: 0, color: "#666" }}>
          Build a quick quiz that will appear under matching lessons in
          <strong> Test your knowledge</strong>.
        </p>

        {error && (
          <div
            style={{
              marginTop: "12px",
              marginBottom: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              backgroundColor: "#f8d7da",
              color: "#721c24",
              border: "1px solid #f5c6cb",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              marginTop: "12px",
              marginBottom: "12px",
              padding: "10px 12px",
              borderRadius: "8px",
              backgroundColor: "#d4edda",
              color: "#155724",
              border: "1px solid #c3e6cb",
              fontSize: "0.9rem",
            }}
          >
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Basic info */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. GCSE AQA Algebra Basics"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Short description for this quiz"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                resize: "vertical",
              }}
            />
          </div>

          {/* Metadata row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div style={{ minWidth: "150px", flex: "1 1 150px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Level
              </label>
              <select
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value as "gcse" | "a-level" | "ks3" | "")
                }
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="">Select level</option>
                <option value="gcse">GCSE</option>
                <option value="a-level">A-Level</option>
                <option value="ks3">KS3</option>
              </select>
            </div>

            <div style={{ minWidth: "150px", flex: "1 1 150px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="">Select subject</option>
                <option value="maths">Mathematics</option>
                <option value="biology">Biology</option>
                <option value="chemistry">Chemistry</option>
                <option value="physics">Physics</option>
                <option value="english">English</option>
              </select>
            </div>

            <div style={{ minWidth: "150px", flex: "1 1 150px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Exam board
              </label>
              <select
                value={examBoard}
                onChange={(e) => setExamBoard(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              >
                <option value="">Select board</option>
                <option value="aqa">AQA</option>
                <option value="edexcel">Edexcel</option>
                <option value="ocr">OCR</option>
              </select>
            </div>

            <div style={{ minWidth: "150px", flex: "2 1 200px" }}>
              <label
                style={{
                  display: "block",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                Module / topic
              </label>
              <input
                type="text"
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="e.g. algebra, organic chemistry, fractions"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              />
            </div>
          </div>

          {/* Questions */}
          <h2 style={{ marginTop: "0", marginBottom: "8px" }}>Questions</h2>
          <p style={{ marginTop: 0, marginBottom: "16px", color: "#666" }}>
            Add multiple choice questions (2–4 options each). Choose the correct
            answer for every question.
          </p>

          {questions.map((question, qIndex) => (
            <div
              key={qIndex}
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#f9fafb",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <strong>Question {qIndex + 1}</strong>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIndex)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#e53e3e",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ marginBottom: "10px" }}>
                <textarea
                  value={question.questionText}
                  onChange={(e) =>
                    handleQuestionChange(
                      qIndex,
                      "questionText",
                      e.target.value
                    )
                  }
                  rows={2}
                  placeholder="Enter the question text"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e0",
                    resize: "vertical",
                  }}
                />
              </div>

              <div style={{ marginBottom: "10px" }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "6px",
                    fontSize: "0.9rem",
                  }}
                >
                  Options (select the correct one)
                </div>
                {question.options.map((opt, optIndex) => (
                  <label
                    key={optIndex}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "6px",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      checked={question.correctIndex === optIndex}
                      onChange={() =>
                        handleQuestionChange(qIndex, "correctIndex", optIndex)
                      }
                    />
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) =>
                        handleOptionChange(qIndex, optIndex, e.target.value)
                      }
                      placeholder={`Option ${optIndex + 1}`}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e0",
                      }}
                    />
                  </label>
                ))}
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: "4px",
                    fontSize: "0.9rem",
                  }}
                >
                  Explanation (optional)
                </label>
                <textarea
                  value={question.explanation || ""}
                  onChange={(e) =>
                    handleQuestionChange(
                      qIndex,
                      "explanation",
                      e.target.value
                    )
                  }
                  rows={2}
                  placeholder="Explain why this answer is correct"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e0",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addQuestion}
            style={{
              marginBottom: "20px",
              padding: "0.5rem 1.25rem",
              borderRadius: "999px",
              border: "1px dashed #a0aec0",
              background: "#f7fafc",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            + Add another question
          </button>

          <div style={{ textAlign: "right" }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "999px",
                border: "none",
                background: submitting ? "#a0aec0" : "#667eea",
                color: "white",
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "Saving quiz..." : "Create quiz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuizPage;
