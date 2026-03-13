/**
 * Admin Question Banks — moderation for all bank types. Admin only.
 * Tabs: Flashcards | Quizzes | Exam questions. Lists all items with View/Edit/Delete/Move.
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { reassignTopicFlashcard } from "../api/topicFlashcards";
import { getStoredSpecKey } from "../utils/specKey";

type Tab = "flashcards" | "quizzes" | "exam-questions";

interface FlashcardRow {
  id: string;
  front: string;
  back: string;
  topicKey: string;
  topic?: string;
  status: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

interface QuizRow {
  id: string;
  questionText: string;
  topicKey: string;
  type: string;
  kind: string;
  status: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

interface ExamRow {
  id: string;
  question: string;
  subject: string;
  examBoard: string;
  level: string;
  topic: string;
  topicKey: string;
  type: string;
  status: string;
  marks: number;
  teacherId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

const DELETE_WARNING = "This will permanently delete this item from the question bank.";

export default function AdminQuestionBanksPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser({ watchLocation: true });
  const [activeTab, setActiveTab] = useState<Tab>("flashcards");
  const [flashcards, setFlashcards] = useState<FlashcardRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [examQuestions, setExamQuestions] = useState<ExamRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: Tab;
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [moveModal, setMoveModal] = useState<{ row: FlashcardRow } | null>(null);
  const [moveTargetKey, setMoveTargetKey] = useState("");
  const [moveSaving, setMoveSaving] = useState(false);
  const [moveSuccessToast, setMoveSuccessToast] = useState<string | null>(null);

  const specKey = getStoredSpecKey();
  const { data: taxonomy } = useTaxonomy(specKey);
  const units = taxonomy?.units ?? [];
  const allTopics = units.flatMap((u) => (u.topics || []).map((t) => ({ ...t, unit: u.unit })));

  // Filters
  const [filters, setFilters] = useState({
    topicKey: "",
    status: "",
    limit: 50,
    offset: 0,
  });

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user?.userType !== "admin") {
      navigate("/dashboard");
      return;
    }
  }, [user?.userType, navigate]);

  // Prefill from URL (e.g. from Gap Priorities: ?tab=exam-questions&topicKey=X)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const topicParam = searchParams.get("topicKey");
    if (tabParam === "exam-questions" || tabParam === "quizzes" || tabParam === "flashcards") {
      setActiveTab(tabParam);
    }
    if (topicParam) {
      setFilters((f) => ({ ...f, topicKey: topicParam }));
    }
  }, [searchParams]);

  const fetchFlashcards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        limit: filters.limit,
        offset: filters.offset,
      };
      if (filters.topicKey) params.topicKey = filters.topicKey;
      if (filters.status) params.status = filters.status;
      const res = await api.get("/admin/question-banks/flashcards", { params });
      setFlashcards(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load flashcards");
      setFlashcards([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters.limit, filters.offset, filters.topicKey, filters.status]);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        limit: filters.limit,
        offset: filters.offset,
      };
      if (filters.topicKey) params.topicKey = filters.topicKey;
      if (filters.status) params.status = filters.status;
      const res = await api.get("/admin/question-banks/quizzes", { params });
      setQuizzes(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load quizzes");
      setQuizzes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters.limit, filters.offset, filters.topicKey, filters.status]);

  const fetchExamQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        limit: filters.limit,
        offset: filters.offset,
      };
      if (filters.topicKey) params.topicKey = filters.topicKey;
      if (filters.status) params.status = filters.status;
      const res = await api.get("/admin/question-banks/exam-questions", { params });
      setExamQuestions(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Failed to load exam questions");
      setExamQuestions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters.limit, filters.offset, filters.topicKey, filters.status]);

  useEffect(() => {
    if (user?.userType !== "admin") return;
    if (activeTab === "flashcards") fetchFlashcards();
    if (activeTab === "quizzes") fetchQuizzes();
    if (activeTab === "exam-questions") fetchExamQuestions();
  }, [user?.userType, activeTab, fetchFlashcards, fetchQuizzes, fetchExamQuestions]);

  const handleDeleteConfirm = (type: Tab, id: string, label: string) => {
    setDeleteConfirm({ type, id, label });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const handleMoveOpen = (row: FlashcardRow) => {
    setMoveModal({ row });
    setMoveTargetKey("");
  };

  const handleMoveClose = () => {
    setMoveModal(null);
    setMoveTargetKey("");
  };

  const handleMoveConfirm = async () => {
    if (!moveModal || !moveTargetKey.trim()) return;
    setMoveSaving(true);
    try {
      const topicMeta = allTopics.find((t) => t.key === moveTargetKey.trim());
      const targetTopicDisplay = topicMeta?.topic || moveTargetKey.trim();
      await reassignTopicFlashcard(moveModal.row.id, {
        topicKey: moveTargetKey.trim(),
        specKey,
        topic: topicMeta?.topic,
      });
      setFlashcards((prev) => prev.filter((x) => x.id !== moveModal.row.id));
      setTotal((t) => Math.max(0, t - 1));
      setMoveSuccessToast(`Flashcard moved to ${targetTopicDisplay}.`);
      setTimeout(() => setMoveSuccessToast(null), 4000);
      handleMoveClose();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.response?.data?.msg || e?.message || "Move failed");
    } finally {
      setMoveSaving(false);
    }
  };

  const handleDeleteExecute = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const { type, id } = deleteConfirm;
      if (type === "flashcards") {
        await api.delete(`/topic-flashcards/${id}`);
        setFlashcards((prev) => prev.filter((x) => x.id !== id));
      } else if (type === "quizzes") {
        await api.delete(`/topic-quiz-questions/${id}`);
        setQuizzes((prev) => prev.filter((x) => x.id !== id));
      } else {
        await api.delete(`/exam-questions/${id}`);
        setExamQuestions((prev) => prev.filter((x) => x.id !== id));
      }
      setTotal((t) => Math.max(0, t - 1));
      setDeleteConfirm(null);
    } catch (e: any) {
      alert(e?.response?.data?.msg || e?.response?.data?.error || e?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const editUrl = (type: Tab, row: FlashcardRow | QuizRow | ExamRow) => {
    const tk = "topicKey" in row ? row.topicKey : "";
    const q = tk ? `?topicKey=${encodeURIComponent(tk)}` : "";
    if (type === "flashcards") return `/teacher/topic-banks/flashcards${q}`;
    if (type === "quizzes") return `/teacher/topic-banks/quizzes${q}`;
    return `/teacher/exam-question-bank${q}`;
  };

  if (user?.userType !== "admin") return null;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 0 }}>Question Banks</h1>
          <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>Admin moderation for flashcards, quizzes, and exam questions</p>
        </div>
        <Link
          to="/admin"
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#f3f4f6",
            color: "#374151",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          ← Admin Dashboard
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid #e5e7eb", paddingBottom: 0 }}>
        {(["flashcards", "quizzes", "exam-questions"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.6rem 1.2rem",
              border: "none",
              background: activeTab === tab ? "#fff" : "transparent",
              borderBottom: activeTab === tab ? "2px solid #6366f1" : "2px solid transparent",
              color: activeTab === tab ? "#6366f1" : "#6b7280",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {tab === "flashcards" ? "Flashcards" : tab === "quizzes" ? "Quizzes" : "Exam Questions"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Topic key (filter)"
          value={filters.topicKey}
          onChange={(e) => setFilters((f) => ({ ...f, topicKey: e.target.value, offset: 0 }))}
          style={{ padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, minWidth: 160 }}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, offset: 0 }))}
          style={{ padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6 }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <button
          type="button"
          onClick={() => {
            if (activeTab === "flashcards") fetchFlashcards();
            else if (activeTab === "quizzes") fetchQuizzes();
            else fetchExamQuestions();
          }}
          style={{ padding: "0.5rem 1rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
        >
          Apply
        </button>
      </div>

      {error && (
        <div style={{ padding: "1rem", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : (
        <>
          {activeTab === "flashcards" && (
            <FlashcardTable rows={flashcards} total={total} onDelete={handleDeleteConfirm} onMove={handleMoveOpen} editUrl={editUrl} isAdmin />
          )}
          {activeTab === "quizzes" && (
            <QuizTable rows={quizzes} total={total} onDelete={handleDeleteConfirm} editUrl={editUrl} />
          )}
          {activeTab === "exam-questions" && (
            <ExamTable rows={examQuestions} total={total} onDelete={handleDeleteConfirm} editUrl={editUrl} />
          )}
        </>
      )}

      {/* Move success toast */}
      {moveSuccessToast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "12px 20px", background: "#059669", color: "#fff", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 10000, fontWeight: 500 }}>
          {moveSuccessToast}
        </div>
      )}

      {/* Move flashcard modal */}
      {moveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", padding: "1.5rem 2rem", borderRadius: 12, maxWidth: 420, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Move to another topic</h3>
            <p style={{ color: "#6b7280", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              Card: &quot;{moveModal.row.front.slice(0, 50)}{moveModal.row.front.length > 50 ? "…" : ""}&quot;
            </p>
            <p style={{ fontSize: "0.85rem", color: "#374151", marginBottom: "0.25rem" }}><strong>Current topic:</strong> {moveModal.row.topic || moveModal.row.topicKey || "—"}</p>
            {moveModal.row.topicKey && (
              <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginBottom: "1rem" }}>topicKey: {moveModal.row.topicKey}</p>
            )}
            <p style={{ fontSize: "0.85rem", color: "#374151", marginBottom: "0.5rem" }}><strong>Target topic:</strong></p>
            <select
              value={moveTargetKey}
              onChange={(e) => setMoveTargetKey(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", marginBottom: "1rem" }}
            >
              <option value="">— Select topic —</option>
              {units.map((u) => (
                <optgroup key={u.unit} label={u.unit}>
                  {(u.topics || []).map((t) => (
                    <option key={t.key} value={t.key}>{t.topic}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {moveTargetKey.trim() && (
              <p style={{ fontSize: "0.9rem", color: "#4b5563", marginBottom: "1rem", padding: "8px 12px", background: "#f9fafb", borderRadius: 8 }}>
                This card will be moved from {moveModal.row.topic || moveModal.row.topicKey || "current topic"} to {allTopics.find((t) => t.key === moveTargetKey)?.topic || moveTargetKey}.
              </p>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={handleMoveClose} disabled={moveSaving} style={{ padding: "0.5rem 1rem", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, fontWeight: 600, cursor: moveSaving ? "not-allowed" : "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={handleMoveConfirm} disabled={moveSaving || !moveTargetKey.trim()} style={{ padding: "0.5rem 1rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: moveSaving || !moveTargetKey.trim() ? "not-allowed" : "pointer" }}>
                {moveSaving ? "Moving…" : "Move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", padding: "1.5rem 2rem", borderRadius: 12, maxWidth: 480, boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Permanently delete?</h3>
            <p style={{ color: "#6b7280", marginBottom: "1rem" }}>{DELETE_WARNING}</p>
            <p style={{ fontSize: "0.9rem", color: "#374151", marginBottom: "1rem", wordBreak: "break-word" }}>
              Item: {deleteConfirm.label.slice(0, 120)}{deleteConfirm.label.length > 120 ? "…" : ""}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleDeleteCancel}
                disabled={deleting}
                style={{ padding: "0.5rem 1rem", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteExecute}
                disabled={deleting}
                style={{ padding: "0.5rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer" }}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlashcardTable({
  rows,
  total,
  onDelete,
  onMove,
  editUrl,
  isAdmin,
}: {
  rows: FlashcardRow[];
  total: number;
  onDelete: (type: Tab, id: string, label: string) => void;
  onMove?: (row: FlashcardRow) => void;
  editUrl: (type: Tab, row: FlashcardRow) => string;
  isAdmin?: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>{total} item{total !== 1 ? "s" : ""}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Front</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Topic</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Owner</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Status</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Created</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "0.75rem", maxWidth: 200 }} title={r.front}>{r.front.slice(0, 80)}{r.front.length > 80 ? "…" : ""}</td>
              <td style={{ padding: "0.75rem" }}>{r.topicKey || r.topic || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{r.ownerName || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{r.status}</td>
              <td style={{ padding: "0.75rem", whiteSpace: "nowrap" }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
              <td style={{ padding: "0.75rem" }}>
                <Link to={editUrl("flashcards", r)} target="_blank" rel="noopener noreferrer" style={{ marginRight: 8, color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>View</Link>
                <Link to={editUrl("flashcards", r)} style={{ marginRight: 8, color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>Edit</Link>
                {isAdmin && onMove && (
                  <button type="button" onClick={() => onMove(r)} style={{ marginRight: 8, color: "#7c3aed", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Move</button>
                )}
                <button type="button" onClick={() => onDelete("flashcards", r.id, r.front)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuizTable({
  rows,
  total,
  onDelete,
  editUrl,
}: {
  rows: QuizRow[];
  total: number;
  onDelete: (type: Tab, id: string, label: string) => void;
  editUrl: (type: Tab, row: QuizRow) => string;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>{total} item{total !== 1 ? "s" : ""}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Question</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Topic</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Owner</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Status</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Created</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "0.75rem", maxWidth: 250 }} title={r.questionText}>{r.questionText}{r.questionText.length >= 120 ? "…" : ""}</td>
              <td style={{ padding: "0.75rem" }}>{r.topicKey || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{r.ownerName || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{r.status}</td>
              <td style={{ padding: "0.75rem", whiteSpace: "nowrap" }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
              <td style={{ padding: "0.75rem" }}>
                <Link to={editUrl("quizzes", r)} target="_blank" rel="noopener noreferrer" style={{ marginRight: 8, color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>View</Link>
                <Link to={editUrl("quizzes", r)} style={{ marginRight: 8, color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>Edit</Link>
                <button type="button" onClick={() => onDelete("quizzes", r.id, r.questionText)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExamTable({
  rows,
  total,
  onDelete,
  editUrl,
}: {
  rows: ExamRow[];
  total: number;
  onDelete: (type: Tab, id: string, label: string) => void;
  editUrl: (type: Tab, row: ExamRow) => string;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>{total} item{total !== 1 ? "s" : ""}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Question</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Subject / Spec</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Topic</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Owner</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Status</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Created</th>
            <th style={{ padding: "0.75rem", fontWeight: 600 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "0.75rem", maxWidth: 220 }} title={r.question}>{r.question}{r.question.length >= 120 ? "…" : ""}</td>
              <td style={{ padding: "0.75rem" }}>{[r.subject, r.examBoard, r.level].filter(Boolean).join(" / ") || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{r.topicKey || r.topic || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{r.ownerName || "—"}</td>
              <td style={{ padding: "0.75rem" }}>{r.status}</td>
              <td style={{ padding: "0.75rem", whiteSpace: "nowrap" }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
              <td style={{ padding: "0.75rem" }}>
                <Link to={editUrl("exam-questions", r)} target="_blank" rel="noopener noreferrer" style={{ marginRight: 8, color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>View</Link>
                <Link to={editUrl("exam-questions", r)} style={{ marginRight: 8, color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>Edit</Link>
                <button type="button" onClick={() => onDelete("exam-questions", r.id, r.question)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
