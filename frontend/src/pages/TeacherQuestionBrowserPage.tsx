/**
 * PR-QUESTION-BROWSER-1: Teacher Questions browser — view and edit by Spec → Collection → Topic.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { SpecSelector } from "../components/SpecSelector";
import { useTaxonomy } from "../hooks/useTaxonomy";
import type { SpecKey } from "../api/taxonomy";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { listTopicQuizQuestions } from "../api/topicQuizQuestions";
import type { TopicQuizQuestion as QuizQ } from "../api/topicQuizQuestions";
import { listTopicFlashcards } from "../api/topicFlashcards";
import type { TopicFlashcard } from "../api/topicFlashcards";
import {
  fetchPastPaperQuestionsByTopic,
  fetchMyExamQuestionsByTopic,
  patchTopicQuizQuestion,
  patchTopicFlashcard,
  patchExamQuestion,
  patchPastPaperQuestion,
  type PastPaperQuestion,
  type ExamQuestion,
} from "../api/questionBrowser";

type Unit = { unit: string; topics: { topic: string; key: string }[] };

function letterFromIndex(i: number) {
  return String.fromCharCode(65 + i);
}

const TeacherQuestionBrowserPage: React.FC = () => {
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey());
  const { data: taxonomy } = useTaxonomy(specKey);

  const units: Unit[] = (taxonomy?.units ?? []) as Unit[];
  const [selectedUnit, setSelectedUnit] = useState("");
  const [topicKey, setTopicKey] = useState("");

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [quizItems, setQuizItems] = useState<QuizQ[]>([]);
  const [flashItems, setFlashItems] = useState<TopicFlashcard[]>([]);
  const [examItems, setExamItems] = useState<ExamQuestion[]>([]);
  const [ppItems, setPpItems] = useState<PastPaperQuestion[]>([]);

  const topicsInUnit = selectedUnit ? units.find((u) => u.unit === selectedUnit)?.topics ?? [] : [];
  const allTopics = units.flatMap((u) => u.topics || []);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setSelectedUnit("");
    setTopicKey("");
  };

  const loadAll = useCallback(async () => {
    if (!topicKey) {
      setQuizItems([]);
      setFlashItems([]);
      setExamItems([]);
      setPpItems([]);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const [quiz, flash, exam, pp] = await Promise.all([
        listTopicQuizQuestions(topicKey, { specKey, status: "all", mineOnly: true, kind: "quiz" }),
        listTopicFlashcards({ topicKey, specKey, mineOnly: true }),
        fetchMyExamQuestionsByTopic(specKey, topicKey, q || undefined, 200),
        fetchPastPaperQuestionsByTopic(specKey, topicKey, q || undefined, 200),
      ]);
      setQuizItems(quiz);
      setFlashItems(flash);
      setExamItems(Array.isArray(exam) ? exam : []);
      setPpItems(pp);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setMessage(err?.response?.data?.error || err?.message || "Failed to load");
      setQuizItems([]);
      setFlashItems([]);
      setExamItems([]);
      setPpItems([]);
    } finally {
      setLoading(false);
    }
  }, [topicKey, specKey, q]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Questions</h1>
      </div>

      <p style={{ color: "#6b7280", marginTop: 0 }}>
        Browse and edit your content by topic (Quiz, Flashcards, Exam Questions, Past Paper Questions).
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginBottom: 16 }}>
        <SpecSelector value={specKey} onChange={onSpecChange} />

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Collection</label>
          <select
            value={selectedUnit}
            onChange={(e) => {
              setSelectedUnit(e.target.value);
              setTopicKey("");
            }}
            style={{ padding: "8px 12px", minWidth: 240, borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="">— Select collection —</option>
            {units.map((u) => (
              <option key={u.unit} value={u.unit}>
                {u.unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Topic</label>
          <select
            value={topicKey}
            onChange={(e) => setTopicKey(e.target.value)}
            style={{ padding: "8px 12px", minWidth: 300, borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="">— Select topic —</option>
            {(selectedUnit ? topicsInUnit : allTopics).map((t) => (
              <option key={t.key} value={t.key}>
                {t.topic}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Search (optional)</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search within topic..."
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db" }}
          />
        </div>

        <button
          type="button"
          onClick={() => loadAll()}
          disabled={!topicKey || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            fontWeight: 700,
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            marginBottom: 12,
          }}
        >
          {message}
        </div>
      )}

      {!topicKey && <div style={{ color: "#6b7280" }}>Select a topic to view questions.</div>}

      {topicKey && (
        <div style={{ display: "grid", gap: 16 }}>
          <SectionQuiz items={quizItems} onUpdated={setQuizItems} />
          <SectionFlashcards items={flashItems} onUpdated={setFlashItems} />
          <SectionExam items={examItems} onUpdated={setExamItems} />
          <SectionPastPaper items={ppItems} onUpdated={setPpItems} />
        </div>
      )}
    </div>
  );
};

export default TeacherQuestionBrowserPage;

function SectionShell({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
          {title} <span style={{ color: "#6b7280", fontWeight: 600 }}>({count})</span>
        </h2>
      </div>
      {children}
    </section>
  );
}

function SectionQuiz({ items, onUpdated }: { items: QuizQ[]; onUpdated: (v: QuizQ[]) => void }) {
  async function edit(item: QuizQ) {
    const newText = window.prompt("Edit question text:", item.questionText);
    if (newText == null) return;

    if (item.type === "mcq") {
      const rawChoices = window.prompt("Edit choices (separate by |):", (item.choices ?? []).join(" | "));
      if (rawChoices == null) return;
      const choices = rawChoices
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);

      const correct = window.prompt(
        "Correct choice letter (A-F):",
        letterFromIndex(item.correctIndex ?? 0)
      );
      if (correct == null) return;

      try {
        const updated = await patchTopicQuizQuestion(item._id, {
          questionText: newText,
          type: "mcq",
          choices,
          correctChoice: correct,
        });
        onUpdated(items.map((x) => (x._id === item._id ? (updated as QuizQ) : x)));
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        window.alert(err?.response?.data?.error || "Update failed");
      }
      return;
    }

    const rawAnswers = window.prompt(
      "Acceptable answers (separate by |):",
      (item.acceptableAnswers ?? []).join(" | ")
    );
    if (rawAnswers == null) return;
    const acceptableAnswers = rawAnswers
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const updated = await patchTopicQuizQuestion(item._id, {
        questionText: newText,
        type: "short-answer",
        acceptableAnswers,
      });
      onUpdated(items.map((x) => (x._id === item._id ? (updated as QuizQ) : x)));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      window.alert(err?.response?.data?.error || "Update failed");
    }
  }

  return (
    <SectionShell title="Quiz questions (MCQ + Short)" count={items.length}>
      {items.length === 0 ? (
        <div style={{ color: "#6b7280" }}>None.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((q) => (
            <li key={q._id} style={{ borderTop: "1px solid #f3f4f6", padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {q.questionText}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>
                    {q.type === "mcq"
                      ? `MCQ · Correct: ${letterFromIndex(q.correctIndex ?? 0)} · Choices: ${(q.choices ?? []).length}`
                      : `Short · Answers: ${(q.acceptableAnswers ?? []).length}`}
                    {" · "}
                    {q.status}
                  </div>
                </div>
                <button
                  onClick={() => edit(q)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
        Note: MVP edit uses prompts. Next iteration can replace with proper modals (same data shape).
      </div>
    </SectionShell>
  );
}

function SectionFlashcards({
  items,
  onUpdated,
}: {
  items: TopicFlashcard[];
  onUpdated: (v: TopicFlashcard[]) => void;
}) {
  async function edit(item: TopicFlashcard) {
    const front = window.prompt("Edit front:", item.front);
    if (front == null) return;
    const back = window.prompt("Edit back:", item.back);
    if (back == null) return;
    try {
      const updated = await patchTopicFlashcard(item._id, { front, back });
      onUpdated(items.map((x) => (x._id === item._id ? (updated as TopicFlashcard) : x)));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      window.alert(err?.response?.data?.error || "Update failed");
    }
  }

  return (
    <SectionShell title="Flashcards" count={items.length}>
      {items.length === 0 ? (
        <div style={{ color: "#6b7280" }}>None.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((f) => (
            <li key={f._id} style={{ borderTop: "1px solid #f3f4f6", padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word" }}>{f.front}</div>
                  <div style={{ color: "#6b7280", fontSize: 12, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {f.back}
                  </div>
                </div>
                <button
                  onClick={() => edit(f)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

function SectionExam({ items, onUpdated }: { items: ExamQuestion[]; onUpdated: (v: ExamQuestion[]) => void }) {
  async function edit(item: ExamQuestion) {
    const question = window.prompt("Edit question:", item.question);
    if (question == null) return;
    const ms = window.prompt(
      "Edit mark scheme lines (separate by |):",
      Array.isArray(item.markScheme) ? item.markScheme.join(" | ") : String(item.markScheme || "")
    );
    if (ms == null) return;
    const markScheme = ms
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const updated = await patchExamQuestion(item._id, { question, markScheme });
      onUpdated(items.map((x) => (x._id === item._id ? updated : x)));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      window.alert(err?.response?.data?.error || "Update failed");
    }
  }

  return (
    <SectionShell title="Exam Questions" count={items.length}>
      {items.length === 0 ? (
        <div style={{ color: "#6b7280" }}>None.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((e) => (
            <li key={e._id} style={{ borderTop: "1px solid #f3f4f6", padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word" }}>{e.question}</div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>Marks: {e.marks ?? "—"}</div>
                </div>
                <button
                  onClick={() => edit(e)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

function SectionPastPaper({
  items,
  onUpdated,
}: {
  items: PastPaperQuestion[];
  onUpdated: (v: PastPaperQuestion[]) => void;
}) {
  async function edit(item: PastPaperQuestion) {
    const question = window.prompt("Edit question:", item.question);
    if (question == null) return;
    const ms = window.prompt(
      "Edit mark scheme lines (separate by |):",
      Array.isArray(item.markScheme) ? item.markScheme.join(" | ") : String(item.markScheme || "")
    );
    if (ms == null) return;
    const markScheme = ms
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const updated = await patchPastPaperQuestion(item._id, { question, markScheme });
      onUpdated(items.map((x) => (x._id === item._id ? updated : x)));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      window.alert(err?.response?.data?.error || "Update failed");
    }
  }

  return (
    <SectionShell title="Past Paper Questions" count={items.length}>
      {items.length === 0 ? (
        <div style={{ color: "#6b7280" }}>None.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((p) => (
            <li key={p._id} style={{ borderTop: "1px solid #f3f4f6", padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, whiteSpace: "normal", wordBreak: "break-word" }}>{p.question}</div>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>
                    Q#: {p.questionNumber ?? "—"} · Marks: {p.marks ?? "—"}
                  </div>
                </div>
                <button
                  onClick={() => edit(p)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff",
                  }}
                >
                  Edit
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}
