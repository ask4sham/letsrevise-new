/**
 * Step 4 (LLM Roadmap): "Ask about this lesson" — RAG Q&A grounded in lesson content.
 */
import React, { useState } from "react";
import { askRAG } from "../../api/ai";

type Props = {
  lessonId: string;
  lessonTitle?: string;
  className?: string;
};

export function AskAboutLesson({ lessonId, lessonTitle, className }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await askRAG({ question: q, lessonId });
      setAnswer(res.answer || "No answer returned.");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={className}
      style={{
        marginTop: 24,
        padding: "1rem 1.25rem",
        borderRadius: 12,
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#166534" }}>
        Ask the AI tutor about this topic
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#15803d" }}>
        Ask a question and get an answer grounded in this lesson’s content.
      </p>
      <form onSubmit={handleAsk} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What is the role of chlorophyll?"
          maxLength={500}
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            border: "1px solid #86efac",
            borderRadius: 8,
            fontSize: 16,
            background: "#fff",
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            padding: "0.5rem 1rem",
            background: loading ? "#9ca3af" : "#16a34a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {loading ? "…" : "Ask"}
        </button>
      </form>
      {error && <p style={{ margin: "8px 0 0 0", color: "#b91c1c", fontSize: "0.9rem" }}>{error}</p>}
      {answer && !loading && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #bbf7d0",
            fontSize: "0.95rem",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {answer}
        </div>
      )}
    </div>
  );
}
