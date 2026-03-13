/**
 * PR-PAST-PAPERS-UI-2: Manual add past paper question (topic + question + mark scheme).
 */
import React, { useState } from "react";
import type { TaxonomyResponse } from "../../api/taxonomy";
import { linkPastPaperQuestions, type LinkQuestionItem } from "../../api/pastPaperQuestions";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
  pastPaperId: string;
  specKey: string;
  token: string;
  taxonomy: TaxonomyResponse | null;
};

const emptyItem: LinkQuestionItem = {
  topicKey: "",
  questionNumber: "",
  marks: undefined,
  question: "",
  markScheme: "",
};

export function LinkQuestionsModal({
  isOpen,
  onClose,
  onLinked,
  pastPaperId,
  specKey,
  token,
  taxonomy,
}: Props) {
  const [topicKey, setTopicKey] = useState("");
  const [questionNumber, setQuestionNumber] = useState("");
  const [marks, setMarks] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [markScheme, setMarkScheme] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const topics: { key: string; topic: string }[] = [];
  if (taxonomy?.units) {
    for (const u of taxonomy.units) {
      for (const t of u.topics || []) {
        topics.push({ key: t.key, topic: t.topic || t.key });
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!question.trim()) {
      setError("Question text is required.");
      return;
    }
    if (!topicKey.trim()) {
      setError("Please select a topic.");
      return;
    }
    setLoading(true);
    try {
      const items: LinkQuestionItem[] = [
        {
          topicKey: topicKey.trim(),
          questionNumber: questionNumber.trim() || undefined,
          marks: marks.trim() ? parseInt(marks, 10) : undefined,
          question: question.trim(),
          markScheme: markScheme.trim() || undefined,
        },
      ];
      await linkPastPaperQuestions(pastPaperId, specKey, items, token);
      setTopicKey("");
      setQuestionNumber("");
      setMarks("");
      setQuestion("");
      setMarkScheme("");
      onLinked();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to link question");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Link question</h2>
          <button type="button" onClick={onClose} style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
            Close
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          Add a teacher-authored question linked to this past paper. Choose a topic from the taxonomy.
        </p>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ marginBottom: 12, padding: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
              {error}
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Topic *</label>
            <select
              value={topicKey}
              onChange={(e) => setTopicKey(e.target.value)}
              required
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
            >
              <option value="">— Select topic —</option>
              {topics.map((t) => (
                <option key={t.key} value={t.key}>{t.topic}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Question number</label>
              <input
                type="text"
                value={questionNumber}
                onChange={(e) => setQuestionNumber(e.target.value)}
                placeholder="e.g. 1(a)"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Marks</label>
              <input
                type="number"
                min={0}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="—"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13 }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Question *</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              rows={3}
              placeholder="Question text (teacher-authored)"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, resize: "vertical" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Mark scheme</label>
            <textarea
              value={markScheme}
              onChange={(e) => setMarkScheme(e.target.value)}
              rows={2}
              placeholder="Optional"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: "8px 14px", borderRadius: 8, background: loading ? "#9ca3af" : "#059669", color: "#fff", fontWeight: 600, border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Linking…" : "Add question"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
