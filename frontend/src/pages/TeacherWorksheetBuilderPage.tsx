// PR-W2: Teacher Worksheet Builder — two-pane: Question Bank → Worksheet Preview
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  createWorksheet,
  getWorksheet,
  updateWorksheet,
  publishWorksheet,
  type Worksheet,
  type WorksheetQuestionItem,
} from "../api/worksheets";
import { seedAqaBio } from "../api/devTools";
import {
  createAssignment,
  type Assignment,
} from "../api/worksheetAssignments";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { SpecKey } from "../api/taxonomy";

type ExamQuestion = {
  _id: string;
  subject?: string;
  topicKey?: string | null;
  type?: string;
  marks: number;
  question: string;
  options?: string[];
  status?: string;
};

type TaxonomyUnit = { unit: string; topics: { topic: string; key: string }[] };

const DEBOUNCE_MS = 500;

const showDevTools =
  process.env.NODE_ENV !== "production" ||
  process.env.REACT_APP_DEV_TOOLS === "1";

/** PR-W2.3: Dev-only panel — 1-click populate question bank by scope. */
function DevToolsSeedPanel({
  onSeedComplete,
}: {
  onSeedComplete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (scope: string, label: string) => {
    setMessage(null);
    setBusy(true);
    try {
      const res = await seedAqaBio(scope);
      if (res.ok) {
        const total = res.results?.reduce((s, r) => s + (r.inserted || 0), 0) ?? 0;
        setMessage(`Seed complete: ${label} (${total} inserted). Refreshing list…`);
        onSeedComplete();
      } else {
        setMessage(res.msg || "Seed failed");
      }
    } catch (e: any) {
      setMessage(e?.response?.data?.msg || e?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="no-print"
      style={{
        marginBottom: "1rem",
        padding: "12px",
        background: "#f0fdf4",
        border: "1px solid #22c55e",
        borderRadius: "8px",
        fontSize: "0.875rem",
      }}
    >
      <strong>Dev Tools</strong> — Populate question bank (dev only)
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
        <button type="button" disabled={busy} onClick={() => run("cell-biology", "Cell Biology (All)")}>
          Populate Cell Biology (All)
        </button>
        <button type="button" disabled={busy} onClick={() => run("cell-biology-batch-a", "Batch A")}>
          Populate Cell Biology (Batch A)
        </button>
        <button type="button" disabled={busy} onClick={() => run("cell-biology-batch-b", "Batch B")}>
          Populate Cell Biology (Batch B)
        </button>
        <button type="button" disabled={busy} onClick={() => run("cell-biology-batch-c", "Batch C")}>
          Populate Cell Biology (Batch C)
        </button>
        <button type="button" disabled={busy} onClick={() => run("all", "Full GCSE Biology")}>
          Populate Full GCSE Biology
        </button>
      </div>
      {message && <div style={{ marginTop: "8px", color: "#166534" }}>{message}</div>}
    </div>
  );
}

const TeacherWorksheetBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [filterTopicKey, setFilterTopicKey] = useState<string>("");
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomy } = useTaxonomy(specKey);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [seedBankLoading, setSeedBankLoading] = useState(false);
  const [seedBankMessage, setSeedBankMessage] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDueAt, setAssignDueAt] = useState("");
  const [assignCreating, setAssignCreating] = useState(false);
  const [createdAssignment, setCreatedAssignment] = useState<Assignment | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestWorksheetRef = useRef<Worksheet | null>(null);

  const { user } = useCurrentUser({ watchLocation: true });
  const isAdmin = (user?.userType || user?.type || "").toString().toLowerCase() === "admin";
  useEffect(() => {
    latestWorksheetRef.current = worksheet;
  }, [worksheet]);

  const selectedIds = new Set((worksheet?.questionItems ?? []).map((i) => String(i.examQuestionId)));
  const questionMap = React.useMemo(() => {
    const m: Record<string, ExamQuestion> = {};
    questions.forEach((q) => {
      m[q._id] = q;
    });
    return m;
  }, [questions]);

  // Load worksheet
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError(null);
    getWorksheet(id)
      .then((ws) => {
        if (!cancelled) {
          setWorksheet(ws);
          if (ws.topicKey && !filterTopicKey) setFilterTopicKey(ws.topicKey);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setLoadError(err?.response?.status === 404 ? "Worksheet not found." : err?.message || "Failed to load worksheet.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    if (filterTopicKey) setFilterTopicKey("");
  };

  const keyToTopic = React.useMemo(() => {
    const map: Record<string, string> = {};
    taxonomy?.units?.forEach((u) => {
      u.topics?.forEach((t) => {
        map[t.key] = t.topic;
      });
    });
    return map;
  }, [taxonomy]);

  const fetchQuestions = useCallback(() => {
    setQuestionsLoading(true);
    api
      .get("/exam-questions", { params: {} })
      .then((res) => {
        const list = Array.isArray(res?.data?.questions) ? res.data.questions : [];
        setQuestions(list);
      })
      .catch(() => setQuestions([]))
      .finally(() => setQuestionsLoading(false));
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handlePopulateQuestionBank = useCallback(() => {
    if (!isAdmin) return;
    setSeedBankMessage(null);
    setSeedBankLoading(true);
    api
      .post("admin/seed-question-bank")
      .then((res) => {
        setSeedBankMessage(res?.data?.message || "Seed started. Refresh the question list in a minute.");
      })
      .catch((err) => {
        setSeedBankMessage(err?.response?.data?.msg || err?.message || "Failed to start seed.");
      })
      .finally(() => setSeedBankLoading(false));
  }, [isAdmin]);

  const bankList = React.useMemo(() => {
    if (!filterTopicKey) return questions;
    return questions.filter((q) => q.topicKey === filterTopicKey);
  }, [questions, filterTopicKey]);

  const persist = useCallback(() => {
    const ws = latestWorksheetRef.current;
    if (!id || !ws) return;
    setSaveStatus("saving");
    updateWorksheet(id, { title: ws.title, questionItems: ws.questionItems })
      .then((updated) => {
        setWorksheet(updated);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      })
      .catch(() => setSaveStatus("error"));
  }, [id]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      persist();
    }, DEBOUNCE_MS);
  }, [persist]);

  const updateTitle = (title: string) => {
    setWorksheet((prev) => (prev ? { ...prev, title } : null));
    scheduleSave();
  };

  const updateQuestionItems = (items: WorksheetQuestionItem[]) => {
    setWorksheet((prev) => (prev ? { ...prev, questionItems: items } : null));
    scheduleSave();
  };

  const handleAdd = (examQuestionId: string) => {
    if (!worksheet || selectedIds.has(examQuestionId)) return;
    const next = [...worksheet.questionItems, { examQuestionId }];
    updateQuestionItems(next);
  };

  const handleRemove = (index: number) => {
    if (!worksheet) return;
    const next = worksheet.questionItems.filter((_, i) => i !== index);
    updateQuestionItems(next);
  };

  const handleMoveUp = (index: number) => {
    if (!worksheet || index <= 0) return;
    const next = [...worksheet.questionItems];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    updateQuestionItems(next);
  };

  const handleMoveDown = (index: number) => {
    if (!worksheet || index >= worksheet.questionItems.length - 1) return;
    const next = [...worksheet.questionItems];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    updateQuestionItems(next);
  };

  const handlePublishToAssign = useCallback(async () => {
    if (!id) return;
    try {
      await publishWorksheet(id);
      const ws = await getWorksheet(id);
      setWorksheet(ws);
    } catch (e) {
      console.error(e);
    }
  }, [id]);

  const handleOpenAssignModal = useCallback(() => {
    setCreatedAssignment(null);
    setAssignTitle(worksheet?.title || "");
    setAssignDueAt("");
    setAssignModalOpen(true);
  }, [worksheet?.title]);

  const handleCreateAssignment = useCallback(async () => {
    if (!id) return;
    setAssignCreating(true);
    try {
      const a = await createAssignment({
        worksheetId: id,
        title: assignTitle.trim() || undefined,
        dueAt: assignDueAt.trim() ? assignDueAt.trim() : null,
      });
      setCreatedAssignment(a);
    } catch (e: any) {
      console.error(e);
      window.alert(e?.response?.data?.error || e?.message || "Failed to create assignment");
    } finally {
      setAssignCreating(false);
    }
  }, [id, assignTitle, assignDueAt]);

  const studentLink = createdAssignment
    ? `${window.location.origin}${window.location.pathname}#/w/${createdAssignment.shareId}`
    : "";

  const copyStudentLink = useCallback(() => {
    if (!studentLink) return;
    navigator.clipboard.writeText(studentLink);
    window.alert("Link copied to clipboard.");
  }, [studentLink]);

  if (loadError) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>{loadError}</p>
        <button type="button" onClick={() => navigate("/teacher-dashboard")} style={{ padding: "8px 16px" }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!worksheet) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading worksheet…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", maxWidth: "1400px", margin: "0 auto" }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "8px" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Worksheet Builder</h1>
        <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            {saveStatus === "saving" && "Saving…"}
            {saveStatus === "saved" && "Saved"}
            {saveStatus === "error" && "Save failed"}
          </span>
          {worksheet.status !== "PUBLISHED" ? (
            <button
              type="button"
              onClick={handlePublishToAssign}
              style={{
                padding: "8px 16px",
                fontSize: "0.875rem",
                background: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Publish to assign
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAssignModal}
              style={{
                padding: "8px 16px",
                fontSize: "0.875rem",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Assign
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              padding: "8px 16px",
              fontSize: "0.875rem",
              background: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Print
          </button>
        </span>
      </div>

      {assignModalOpen && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => !createdAssignment && setAssignModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: "1.25rem" }}>Create assignment</h2>
            {!createdAssignment ? (
              <>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.875rem" }}>
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  placeholder="e.g. Cell Division HW"
                  style={{ width: "100%", padding: "8px 12px", marginBottom: "12px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                />
                <label style={{ display: "block", marginBottom: "8px", fontSize: "0.875rem" }}>Due date (optional)</label>
                <input
                  type="datetime-local"
                  value={assignDueAt}
                  onChange={(e) => setAssignDueAt(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", marginBottom: "16px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                />
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setAssignModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db" }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateAssignment}
                    disabled={assignCreating}
                    style={{ padding: "8px 16px", borderRadius: "6px", background: "#2563eb", color: "#fff", border: "none", cursor: assignCreating ? "wait" : "pointer" }}
                  >
                    {assignCreating ? "Creating…" : "Create assignment"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "#374151" }}>Share this link with students:</p>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                  <input
                    type="text"
                    readOnly
                    value={studentLink}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "0.8125rem" }}
                  />
                  <button type="button" onClick={copyStudentLink} style={{ padding: "8px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", cursor: "pointer" }}>
                    Copy
                  </button>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: "0.875rem" }}>
                  <a href={`#/teacher/worksheet-assignments/${createdAssignment._id}/report`} style={{ color: "#2563eb" }}>
                    View results
                  </a>
                </p>
                <button type="button" onClick={() => setAssignModalOpen(false)} style={{ padding: "8px 16px", borderRadius: "6px", background: "#111827", color: "#fff", border: "none", cursor: "pointer" }}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showDevTools && (
        <DevToolsSeedPanel onSeedComplete={fetchQuestions} />
      )}

      <div
        className="worksheet-builder-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "40% 1fr",
          gap: "1.5rem",
          minHeight: "70vh",
          alignItems: "stretch",
        }}
      >
        {/* Left: Question Bank */}
        <div
          className="worksheet-builder-left no-print"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "#fff",
          }}
        >
          <div style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Question Bank</h2>
            <div style={{ marginBottom: 8 }}>
              <SpecSelector value={specKey} onChange={onSpecChange} />
            </div>
            <select
              value={filterTopicKey}
              onChange={(e) => setFilterTopicKey(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db" }}
            >
              <option value="">All topics</option>
              {taxonomy?.units?.flatMap((u) =>
                (u.topics || []).map((t) => (
                  <option key={t.key} value={t.key}>
                    {u.unit} — {t.topic}
                  </option>
                ))
              )}
            </select>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px", alignItems: "center" }}>
              <button
                type="button"
                onClick={fetchQuestions}
                disabled={questionsLoading}
                style={{ padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: questionsLoading ? "wait" : "pointer" }}
              >
                {questionsLoading ? "Loading…" : "Refresh list"}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handlePopulateQuestionBank}
                  disabled={seedBankLoading}
                  style={{ padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "6px", border: "1px solid #059669", background: "#d1fae5", color: "#065f46", cursor: seedBankLoading ? "wait" : "pointer" }}
                >
                  {seedBankLoading ? "Starting…" : "Populate question bank"}
                </button>
              )}
            </div>
            {seedBankMessage && (
              <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "#0ea5e9" }}>{seedBankMessage}</p>
            )}
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
            {questionsLoading ? (
              <p style={{ color: "#6b7280" }}>Loading questions…</p>
            ) : bankList.length === 0 ? (
              <div style={{ color: "#6b7280" }}>
                <p style={{ margin: "0 0 8px" }}>No questions in this topic.</p>
                {questions.length > 0 && filterTopicKey && (
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "#0ea5e9" }}>
                    Questions in the bank have no topicKey set. Seed this topic from backend:{" "}
                    <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                      node scripts/aqa_gcse_biology/seed_cell-biology__{filterTopicKey}.js
                    </code>{" "}
                    (same MONGO_URI as your app).
                  </p>
                )}
              </div>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {bankList.map((q) => (
                  <li
                    key={q._id}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "8px",
                      background: selectedIds.has(q._id) ? "#f0fdf4" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "4px" }}>
                          {q.marks} {q.marks === 1 ? "mark" : "marks"}
                        </div>
                        <div style={{ fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {q.question || "—"}
                        </div>
                        {q.type === "mcq" && Array.isArray(q.options) && q.options.length > 0 && (
                          <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "4px" }}>
                            {q.options.slice(0, 3).map((opt, i) => (
                              <span key={i}>{String.fromCharCode(65 + i)}: {opt} </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={selectedIds.has(q._id)}
                        onClick={() => handleAdd(q._id)}
                        style={{
                          padding: "6px 12px",
                          fontSize: "0.875rem",
                          background: selectedIds.has(q._id) ? "#e5e7eb" : "#059669",
                          color: selectedIds.has(q._id) ? "#9ca3af" : "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: selectedIds.has(q._id) ? "not-allowed" : "pointer",
                          flexShrink: 0,
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Worksheet Preview */}
        <div
          className="worksheet-builder-right worksheet-page"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "#fff",
          }}
        >
          <div className="no-print" style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Worksheet Preview</h2>
            <input
              type="text"
              value={worksheet.title}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="Worksheet title"
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "1rem",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
              }}
            />
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
            {worksheet.questionItems.length === 0 ? (
              <p style={{ color: "#6b7280" }}>Add questions from the bank to build your worksheet.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: "1.5rem" }}>
                {worksheet.questionItems.map((item, index) => {
                  const q = questionMap[String(item.examQuestionId)];
                  const marks = item.marksOverride ?? q?.marks ?? 0;
                  return (
                    <li
                      key={`${item.examQuestionId}-${index}`}
                      className="worksheet-question"
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "12px",
                        marginBottom: "12px",
                        background: "#fff",
                        position: "relative",
                      }}
                    >
                      <div className="no-print" style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          title="Move up"
                          disabled={index === 0}
                          onClick={() => handleMoveUp(index)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            background: "#f3f4f6",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            cursor: index === 0 ? "not-allowed" : "pointer",
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title="Move down"
                          disabled={index === worksheet.questionItems.length - 1}
                          onClick={() => handleMoveDown(index)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            background: "#f3f4f6",
                            border: "1px solid #d1d5db",
                            borderRadius: "4px",
                            cursor: index === worksheet.questionItems.length - 1 ? "not-allowed" : "pointer",
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          title="Remove"
                          onClick={() => handleRemove(index)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                      <div style={{ paddingRight: "140px" }}>
                        {q ? (
                          <>
                            <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "4px" }}>
                              {marks} {marks === 1 ? "mark" : "marks"}
                            </div>
                            <div style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{q.question || "—"}</div>
                            {q.type === "mcq" && Array.isArray(q.options) && q.options.length > 0 && (
                              <ul style={{ margin: "8px 0 0", paddingLeft: "1.25rem" }}>
                                {q.options.map((opt, i) => (
                                  <li key={i} style={{ fontSize: "0.875rem" }}>
                                    {String.fromCharCode(65 + i)}. {opt}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "#6b7280" }}>Question (ID: {String(item.examQuestionId).slice(-6)})</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherWorksheetBuilderPage;
