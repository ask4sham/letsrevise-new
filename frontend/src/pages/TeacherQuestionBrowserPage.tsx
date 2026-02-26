/**
 * PR-QUESTION-BROWSER-1 + PR-QUESTION-BROWSER-2: Teacher Questions browser — view and edit by Spec → Collection → Topic.
 * Edit via modal forms (MCQ, Short Answer, Flashcard, Exam, Past Paper).
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

export type EditKind = "quiz" | "flashcard" | "exam" | "pastpaper";
export type EditItem = QuizQ | TopicFlashcard | ExamQuestion | PastPaperQuestion;

/** Draft shape for the edit modal; fields vary by kind. */
export type EditDraft = {
  questionText?: string;
  question?: string;
  choices?: string[];
  correctChoice?: string;
  acceptableAnswers?: string[];
  matchMode?: "exact" | "contains";
  explanation?: string;
  front?: string;
  back?: string;
  markScheme?: string[];
  marks?: number;
  questionNumber?: string;
  type?: "mcq" | "short-answer";
};

function letterFromIndex(i: number) {
  return String.fromCharCode(65 + i);
}

function indexFromLetter(l: string): number {
  const u = (l || "A").trim().toUpperCase();
  const code = u.charCodeAt(0);
  if (code >= 65 && code <= 70) return code - 65;
  return 0;
}

function buildDraftFromItem(item: EditItem, kind: EditKind): EditDraft {
  if (kind === "quiz") {
    const q = item as QuizQ;
    const isMcq = q.type === "mcq";
    return {
      questionText: q.questionText ?? "",
      type: isMcq ? "mcq" : "short-answer",
      choices: isMcq ? [...(q.choices ?? [])] : undefined,
      correctChoice: isMcq ? letterFromIndex(q.correctIndex ?? 0) : undefined,
      acceptableAnswers: !isMcq ? [...(q.acceptableAnswers ?? [])] : undefined,
      matchMode: (q as QuizQ).matchMode ?? "contains",
      explanation: (q as QuizQ).explanation ?? "",
    };
  }
  if (kind === "flashcard") {
    const f = item as TopicFlashcard;
    return { front: f.front ?? "", back: f.back ?? "" };
  }
  if (kind === "exam") {
    const e = item as ExamQuestion;
    const ms = Array.isArray(e.markScheme) ? e.markScheme : e.markScheme ? [String(e.markScheme)] : [];
    return { question: e.question ?? "", markScheme: ms, marks: e.marks };
  }
  if (kind === "pastpaper") {
    const p = item as PastPaperQuestion;
    const ms = Array.isArray(p.markScheme) ? p.markScheme : p.markScheme ? [String(p.markScheme)] : [];
    return {
      question: p.question ?? "",
      markScheme: ms,
      marks: p.marks,
      questionNumber: p.questionNumber ?? "",
    };
  }
  return {};
}

const MAX_CHOICES = 6;
const MIN_CHOICES = 2;

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

  // Edit modal state (PR-QUESTION-BROWSER-2)
  const [editOpen, setEditOpen] = useState(false);
  const [editKind, setEditKind] = useState<EditKind>("quiz");
  const [editItem, setEditItem] = useState<EditItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const topicsInUnit = selectedUnit ? units.find((u) => u.unit === selectedUnit)?.topics ?? [] : [];
  const allTopics = units.flatMap((u) => u.topics || []);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setSelectedUnit("");
    setTopicKey("");
  };

  const openEdit = useCallback((item: EditItem, kind: EditKind) => {
    setEditItem(item);
    setEditKind(kind);
    setEditDraft(buildDraftFromItem(item, kind));
    setEditOpen(true);
    setEditError(null);
  }, []);

  const closeEdit = useCallback(() => {
    if (!editSaving) {
      setEditOpen(false);
      setEditItem(null);
      setEditError(null);
    }
  }, [editSaving]);

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

  const handleEditSave = useCallback(async () => {
    if (!editItem) return;
    const id = editItem._id;

    // Validation
    if (editKind === "quiz") {
      const quizItem = editItem as QuizQ;
      const isMcq = (quizItem.type ?? editDraft.type) === "mcq";
      if (isMcq) {
        const choices = (editDraft.choices ?? []).map((s) => String(s).trim()).filter(Boolean);
        if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
          setEditError(`MCQ must have between ${MIN_CHOICES} and ${MAX_CHOICES} choices.`);
          return;
        }
        const cc = (editDraft.correctChoice ?? "A").trim().toUpperCase();
        const idx = indexFromLetter(cc);
        if (idx < 0 || idx >= choices.length) {
          setEditError("Correct choice must be one of the option letters (A–F) within range.");
          return;
        }
      } else {
        const answers = (editDraft.acceptableAnswers ?? []).map((s) => String(s).trim()).filter(Boolean);
        if (answers.length < 1) {
          setEditError("Short answer requires at least one acceptable answer.");
          return;
        }
      }
    }

    setEditSaving(true);
    setEditError(null);
    try {
      if (editKind === "quiz") {
        const quizItem = editItem as QuizQ;
        const isMcq = (quizItem.type ?? editDraft.type) === "mcq";
        const payload = {
          questionText: editDraft.questionText ?? "",
          explanation: editDraft.explanation ?? "",
          type: isMcq ? "mcq" as const : "short-answer" as const,
        };
        if (isMcq) {
          const choices = (editDraft.choices ?? []).map((s) => String(s).trim()).filter(Boolean);
          const correctChoice = (editDraft.correctChoice ?? "A").trim().toUpperCase();
          const updated = await patchTopicQuizQuestion(id, { ...payload, choices, correctChoice });
          setQuizItems((prev) => prev.map((x) => (x._id === id ? (updated as QuizQ) : x)));
        } else {
          const acceptableAnswers = (editDraft.acceptableAnswers ?? []).map((s) => String(s).trim()).filter(Boolean);
          const updated = await patchTopicQuizQuestion(id, {
            ...payload,
            acceptableAnswers,
            matchMode: editDraft.matchMode ?? "contains",
          });
          setQuizItems((prev) => prev.map((x) => (x._id === id ? (updated as QuizQ) : x)));
        }
      } else if (editKind === "flashcard") {
        const updated = await patchTopicFlashcard(id, {
          front: editDraft.front ?? "",
          back: editDraft.back ?? "",
        });
        setFlashItems((prev) => prev.map((x) => (x._id === id ? (updated as TopicFlashcard) : x)));
      } else if (editKind === "exam") {
        const updated = await patchExamQuestion(id, {
          question: editDraft.question ?? "",
          markScheme: editDraft.markScheme ?? [],
          marks: editDraft.marks,
        });
        setExamItems((prev) => prev.map((x) => (x._id === id ? updated : x)));
      } else if (editKind === "pastpaper") {
        const updated = await patchPastPaperQuestion(id, {
          question: editDraft.question ?? "",
          markScheme: editDraft.markScheme ?? [],
          marks: editDraft.marks,
          questionNumber: editDraft.questionNumber ?? undefined,
        });
        setPpItems((prev) => prev.map((x) => (x._id === id ? updated : x)));
      }
      closeEdit();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setEditError(err?.response?.data?.error || err?.message || "Update failed");
    } finally {
      setEditSaving(false);
    }
  }, [editItem, editKind, editDraft, closeEdit]);

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
          <SectionQuiz items={quizItems} onEdit={openEdit} />
          <SectionFlashcards items={flashItems} onEdit={openEdit} />
          <SectionExam items={examItems} onEdit={openEdit} />
          <SectionPastPaper items={ppItems} onEdit={openEdit} />
        </div>
      )}

      {editOpen && editItem && (
        <EditModal
          kind={editKind}
          item={editItem}
          draft={editDraft}
          setDraft={setEditDraft}
          saving={editSaving}
          error={editError}
          onSave={handleEditSave}
          onClose={closeEdit}
        />
      )}
    </div>
  );
};

export default TeacherQuestionBrowserPage;

// ---- Edit Modal (PR-QUESTION-BROWSER-2) ----

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  boxSizing: "border-box" as const,
};
const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6, marginTop: 12 };

function EditModal({
  kind,
  item,
  draft,
  setDraft,
  saving,
  error,
  onSave,
  onClose,
}: {
  kind: EditKind;
  item: EditItem;
  draft: EditDraft;
  setDraft: React.Dispatch<React.SetStateAction<EditDraft>>;
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const isQuizMcq = kind === "quiz" && (item as QuizQ).type === "mcq";
  const isQuizShort = kind === "quiz" && (item as QuizQ).type === "short-answer";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: 560,
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
          padding: 24,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800 }}>
          {kind === "quiz" && "Edit quiz question"}
          {kind === "flashcard" && "Edit flashcard"}
          {kind === "exam" && "Edit exam question"}
          {kind === "pastpaper" && "Edit past paper question"}
        </h2>

        {error && (
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
            {error}
          </div>
        )}

        {/* Quiz MCQ */}
        {kind === "quiz" && isQuizMcq && (
          <>
            <label style={labelStyle}>Question text</label>
            <textarea
              value={draft.questionText ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, questionText: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, minHeight: 60 }}
            />
            <label style={labelStyle}>Choices (2–6; one per line or comma-separated)</label>
            <textarea
              value={(draft.choices ?? []).join("\n")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  choices: e.target.value
                    .split(/[\n,]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              placeholder={"First option\nSecond option"}
              rows={4}
              style={{ ...inputStyle, minHeight: 80 }}
            />
            <label style={labelStyle}>Correct choice (A–F)</label>
            <select
              value={draft.correctChoice ?? "A"}
              onChange={(e) => setDraft((d) => ({ ...d, correctChoice: e.target.value }))}
              style={inputStyle}
            >
              {(() => {
                const choiceCount = Math.max(
                  MIN_CHOICES,
                  Math.min(MAX_CHOICES, (draft.choices ?? []).filter(Boolean).length || MIN_CHOICES)
                );
                return ["A", "B", "C", "D", "E", "F"]
                  .slice(0, choiceCount)
                  .map((letter) => (
                    <option key={letter} value={letter}>
                      {letter}
                    </option>
                  ));
              })()}
            </select>
            <label style={labelStyle}>Explanation (optional)</label>
            <textarea
              value={draft.explanation ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
              rows={2}
              style={inputStyle}
            />
          </>
        )}

        {/* Quiz Short Answer */}
        {kind === "quiz" && isQuizShort && (
          <>
            <label style={labelStyle}>Question text</label>
            <textarea
              value={draft.questionText ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, questionText: e.target.value }))}
              rows={3}
              style={{ ...inputStyle, minHeight: 60 }}
            />
            <label style={labelStyle}>Acceptable answers (one per line or separated by |)</label>
            <textarea
              value={(draft.acceptableAnswers ?? []).join("\n")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  acceptableAnswers: e.target.value
                    .split(/[\n|]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="nucleus&#10;the nucleus"
              rows={3}
              style={inputStyle}
            />
            <label style={labelStyle}>Match mode</label>
            <select
              value={draft.matchMode ?? "contains"}
              onChange={(e) =>
                setDraft((d) => ({ ...d, matchMode: e.target.value as "exact" | "contains" }))
              }
              style={inputStyle}
            >
              <option value="contains">Contains</option>
              <option value="exact">Exact</option>
            </select>
            <label style={labelStyle}>Explanation (optional)</label>
            <textarea
              value={draft.explanation ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
              rows={2}
              style={inputStyle}
            />
          </>
        )}

        {/* Flashcard */}
        {kind === "flashcard" && (
          <>
            <label style={labelStyle}>Front</label>
            <textarea
              value={draft.front ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, front: e.target.value }))}
              rows={3}
              style={inputStyle}
            />
            <label style={labelStyle}>Back</label>
            <textarea
              value={draft.back ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, back: e.target.value }))}
              rows={3}
              style={inputStyle}
            />
          </>
        )}

        {/* Exam Question */}
        {kind === "exam" && (
          <>
            <label style={labelStyle}>Question</label>
            <textarea
              value={draft.question ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
              rows={3}
              style={inputStyle}
            />
            <label style={labelStyle}>Mark scheme (one per line or | separated)</label>
            <textarea
              value={(draft.markScheme ?? []).join("\n")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  markScheme: e.target.value
                    .split(/[\n|]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              rows={4}
              style={inputStyle}
            />
            <label style={labelStyle}>Marks (optional)</label>
            <input
              type="number"
              min={1}
              value={draft.marks ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, marks: e.target.value ? parseInt(e.target.value, 10) : undefined }))
              }
              style={inputStyle}
            />
          </>
        )}

        {/* Past Paper Question */}
        {kind === "pastpaper" && (
          <>
            <label style={labelStyle}>Question</label>
            <textarea
              value={draft.question ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
              rows={3}
              style={inputStyle}
            />
            <label style={labelStyle}>Question number (optional)</label>
            <input
              type="text"
              value={draft.questionNumber ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, questionNumber: e.target.value }))}
              style={inputStyle}
              placeholder="e.g. 1a"
            />
            <label style={labelStyle}>Marks (optional)</label>
            <input
              type="number"
              min={1}
              value={draft.marks ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, marks: e.target.value ? parseInt(e.target.value, 10) : undefined }))
              }
              style={inputStyle}
            />
            <label style={labelStyle}>Mark scheme (one per line or | separated)</label>
            <textarea
              value={(draft.markScheme ?? []).join("\n")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  markScheme: e.target.value
                    .split(/[\n|]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              rows={4}
              style={inputStyle}
            />
          </>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "#2563eb",
              color: "#fff",
              border: "none",
              fontWeight: 600,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Sections ----

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

function SectionQuiz({
  items,
  onEdit,
}: {
  items: QuizQ[];
  onEdit: (item: EditItem, kind: EditKind) => void;
}) {
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
                  type="button"
                  onClick={() => onEdit(q, "quiz")}
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

function SectionFlashcards({
  items,
  onEdit,
}: {
  items: TopicFlashcard[];
  onEdit: (item: EditItem, kind: EditKind) => void;
}) {
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
                  type="button"
                  onClick={() => onEdit(f, "flashcard")}
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

function SectionExam({
  items,
  onEdit,
}: {
  items: ExamQuestion[];
  onEdit: (item: EditItem, kind: EditKind) => void;
}) {
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
                  type="button"
                  onClick={() => onEdit(e, "exam")}
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
  onEdit,
}: {
  items: PastPaperQuestion[];
  onEdit: (item: EditItem, kind: EditKind) => void;
}) {
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
                  type="button"
                  onClick={() => onEdit(p, "pastpaper")}
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
