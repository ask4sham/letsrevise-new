import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const QUESTION_TYPES = ["mcq", "short", "label", "table", "data"] as const;
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Geography", "Computer Science", "Other"];
const EXAM_BOARDS = ["AQA", "Edexcel", "OCR", "CIE", "WJEC", "Other"];
const LEVELS = ["GCSE", "A-Level", "IB", "KS3", "Other"];

type ExamQuestion = {
  _id: string;
  subject: string;
  examBoard?: string;
  level?: string;
  topic?: string;
  type: string;
  marks: number;
  question: string;
  options?: string[];
  correctAnswer?: string | null;
  markScheme?: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

const TeacherExamQuestionBankPage: React.FC = () => {
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    topic: "",
    questionType: "mcq" as (typeof QUESTION_TYPES)[number],
    marks: 1,
    questionText: "",
    correctAnswerMarkScheme: "",
  });

  const fetchQuestions = async () => {
    try {
      setError(null);
      const res = await api.get("/exam-questions");
      const data = res?.data;
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load questions");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  function validateForm(): string | null {
    const q = form.questionText.trim();
    if (!q) return "Question text is required.";
    if (form.marks < 1) return "Marks must be at least 1.";
    const answer = form.correctAnswerMarkScheme.trim();
    if (form.questionType === "mcq" && !answer) return "Correct answer is required for MCQ.";
    if (form.questionType === "short" && !answer) return "Correct answer or mark scheme is required for short answer.";
    return null;
  }

  const handleSaveDraft = async () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    try {
      setSaving(true);
      const markScheme = form.correctAnswerMarkScheme
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await api.post("/exam-questions", {
        subject: form.subject,
        examBoard: form.examBoard || undefined,
        level: form.level || undefined,
        topic: form.topic || undefined,
        type: form.questionType,
        marks: form.marks,
        question: form.questionText.trim(),
        correctAnswer: form.correctAnswerMarkScheme.trim() || null,
        markScheme: markScheme.length ? markScheme : [],
        options: [],
      });
      setModalOpen(false);
      setForm({
        subject: "Biology",
        examBoard: "AQA",
        level: "GCSE",
        topic: "",
        questionType: "mcq",
        marks: 1,
        questionText: "",
        correctAnswerMarkScheme: "",
      });
      await fetchQuestions();
    } catch (err: any) {
      alert(err?.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "960px", margin: "0 auto", minHeight: "100vh" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          to="/teacher"
          style={{
            textDecoration: "none",
            color: "#4f46e5",
            fontSize: "0.95rem",
            display: "inline-block",
            marginBottom: "0.75rem",
          }}
        >
          ← Back to Teacher Dashboard
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", color: "#111827" }}>Exam Question Bank</h1>
          <p style={{ margin: "0.35rem 0 0", color: "#6b7280", fontSize: "1rem" }}>
            Create, edit, and organise exam questions
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setModalOpen(true); setFormError(null); }}
          style={{
            padding: "10px 18px",
            background: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          + Create Question
        </button>
      </div>

      {loading && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading questions...</div>
      )}
      {error && (
        <div style={{ padding: "1rem", marginBottom: "1rem", background: "#fef2f2", color: "#991b1b", borderRadius: "8px" }}>
          {error}
        </div>
      )}
      {!loading && questions.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: "12px", fontWeight: 600, color: "#374151" }}>Subject</th>
                <th style={{ textAlign: "left", padding: "12px", fontWeight: 600, color: "#374151" }}>Type</th>
                <th style={{ textAlign: "left", padding: "12px", fontWeight: 600, color: "#374151" }}>Marks</th>
                <th style={{ textAlign: "left", padding: "12px", fontWeight: 600, color: "#374151" }}>Question</th>
                <th style={{ textAlign: "left", padding: "12px", fontWeight: 600, color: "#374151" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q._id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px", color: "#374151" }}>{q.subject}</td>
                  <td style={{ padding: "12px", color: "#374151" }}>{q.type}</td>
                  <td style={{ padding: "12px", color: "#374151" }}>{q.marks}</td>
                  <td style={{ padding: "12px", color: "#374151", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.question}>{q.question || "—"}</td>
                  <td style={{ padding: "12px", color: "#374151" }}>{q.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && questions.length === 0 && !error && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "3rem 2rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", color: "#d1d5db", marginBottom: "1rem" }}>📝</div>
          <h3 style={{ margin: "0 0 0.5rem", color: "#374151" }}>No questions yet</h3>
          <p style={{ margin: 0, color: "#6b7280", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
            Click <strong>Create Question</strong> to add your first exam question. You can build MCQ, short answer, label-the-diagram, table, and data interpretation questions.
          </p>
        </div>
      )}

      {/* Create Question Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              overflow: "auto",
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem" }}>Create Question</h2>

            {formError && (
              <div style={{ marginBottom: "1rem", padding: "10px 12px", background: "#fef2f2", color: "#991b1b", borderRadius: "8px", fontSize: "0.9rem" }}>
                {formError}
              </div>
            )}

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Subject</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Exam board</label>
                <select
                  value={form.examBoard}
                  onChange={(e) => setForm((f) => ({ ...f, examBoard: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  {EXAM_BOARDS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Level</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Topic</label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Cell structure"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Question type</label>
                <select
                  value={form.questionType}
                  onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value as (typeof QUESTION_TYPES)[number] }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Marks</label>
                <input
                  type="number"
                  min={1}
                  value={form.marks}
                  onChange={(e) => setForm((f) => ({ ...f, marks: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Question text</label>
                <textarea
                  value={form.questionText}
                  onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
                  placeholder="Enter the question stem..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Correct answer / mark scheme</label>
                <textarea
                  value={form.correctAnswerMarkScheme}
                  onChange={(e) => setForm((f) => ({ ...f, correctAnswerMarkScheme: e.target.value }))}
                  placeholder="Model answer or mark scheme points..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Image (placeholder)</label>
                <div
                  style={{
                    width: "100%",
                    padding: "24px",
                    border: "2px dashed #d1d5db",
                    borderRadius: "8px",
                    textAlign: "center",
                    color: "#9ca3af",
                    fontSize: "0.9rem",
                  }}
                >
                  Image upload — not connected yet
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  background: "white",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  background: saving ? "#e5e7eb" : "#4f46e5",
                  color: saving ? "#9ca3af" : "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherExamQuestionBankPage;
