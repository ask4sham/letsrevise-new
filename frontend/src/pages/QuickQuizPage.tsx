/**
 * Step 3 (LLM Roadmap): Quick quiz flow — generate practice quiz from topic, then run it in QuizView.
 */
import React, { useState } from "react";
import { generatePracticeQuiz, type PracticeQuizQuestion } from "../api/ai";
import { QuizView, type QuizQuestion } from "../components/revision/QuizView";

const SUBJECT_OPTIONS = [
  "Biology",
  "Chemistry",
  "Physics",
  "Mathematics",
  "Further Mathematics",
  "English Language",
  "English Literature",
  "History",
  "Geography",
  "Computer Science",
  "Business",
  "Economics",
  "Religious Studies",
  "Sociology",
  "Psychology",
  "French",
  "Spanish",
  "German",
  "Other",
] as const;

export default function QuickQuizPage() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState<string>("Biology");
  const [subjectOther, setSubjectOther] = useState("");
  const [level, setLevel] = useState("GCSE");
  const [numQuestions, setNumQuestions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [quizTitle, setQuizTitle] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = topic.trim();
    if (!t) {
      setError("Enter a topic");
      return;
    }
    setLoading(true);
    setError(null);
    setQuestions(null);
    const effectiveSubject = subject === "Other" ? subjectOther.trim() || "General" : subject;
    try {
      const res = await generatePracticeQuiz({
        topic: t,
        subject: effectiveSubject || undefined,
        level: level || undefined,
        numQuestions: numQuestions >= 1 && numQuestions <= 10 ? numQuestions : 5,
      });
      const mapped: QuizQuestion[] = (res.questions as PracticeQuizQuestion[]).map((q) => {
        if (q.type === "mcq") {
          return {
            id: q.id,
            type: "mcq",
            question: q.question,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer,
            marks: q.marks ?? 1,
          };
        }
        return {
          id: q.id,
          type: "short",
          question: q.question,
          correctAnswer: q.correctAnswer,
          marks: q.marks ?? 1,
        };
      });
      setQuestions(mapped);
      setQuizTitle(`Quick quiz: ${t}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || "Failed to generate quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setQuestions(null);
    setQuizTitle("");
    setError(null);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>Quick quiz</h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
        Enter a topic and we’ll generate a short practice quiz for you (AI).
      </p>

      {!questions ? (
        <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="topic" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
              Topic *
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Cell structure, Photosynthesis, World War One, Quadratics, Macbeth…"
              maxLength={200}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 16,
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <label htmlFor="subject" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                Subject
              </label>
              <select
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  minWidth: 180,
                }}
              >
                {SUBJECT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {subject === "Other" && (
                <input
                  type="text"
                  value={subjectOther}
                  onChange={(e) => setSubjectOther(e.target.value)}
                  placeholder="Enter subject name"
                  maxLength={80}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              )}
            </div>
            <div>
              <label htmlFor="level" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                Level
              </label>
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: 8 }}
              >
                <option value="GCSE">GCSE</option>
                <option value="A-Level">A-Level</option>
                <option value="KS3">KS3</option>
              </select>
            </div>
            <div>
              <label htmlFor="numQuestions" style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
                Number of questions
              </label>
              <input
                id="numQuestions"
                type="number"
                min={1}
                max={10}
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value, 10) || 5)}
                style={{
                  width: 64,
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
          {error && <p style={{ color: "#b91c1c", margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !topic.trim()}
            style={{
              padding: "0.6rem 1.2rem",
              background: loading ? "#94a3b8" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Generating…" : "Generate quiz"}
          </button>
        </form>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <span style={{ fontWeight: 600 }}>{quizTitle}</span>
            <button
              type="button"
              onClick={handleStartOver}
              style={{
                padding: "4px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                background: "#f8fafc",
                cursor: "pointer",
              }}
            >
              New quiz
            </button>
          </div>
          <QuizView questions={questions} title={quizTitle} />
        </div>
      )}
    </div>
  );
}
