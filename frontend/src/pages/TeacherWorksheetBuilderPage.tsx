// PR-W2: Teacher Worksheet Builder — two-pane: Question Bank → Worksheet Preview
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  getWorksheet,
  updateWorksheet,
  type Worksheet,
  type WorksheetItem,
} from "../api/worksheets";

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

const TeacherWorksheetBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [filterTopicKey, setFilterTopicKey] = useState<string>("");
  const [taxonomy, setTaxonomy] = useState<{ units: TaxonomyUnit[] } | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestWorksheetRef = useRef<Worksheet | null>(null);
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

  // Taxonomy for topic filter
  useEffect(() => {
    api.get("/taxonomy/aqa-gcse-biology").then((res) => setTaxonomy(res?.data ?? null)).catch(() => setTaxonomy(null));
  }, []);

  const keyToTopic = React.useMemo(() => {
    const map: Record<string, string> = {};
    taxonomy?.units?.forEach((u) => {
      u.topics?.forEach((t) => {
        map[t.key] = t.topic;
      });
    });
    return map;
  }, [taxonomy]);

  // Load exam questions (all for map; filter for bank display)
  useEffect(() => {
    setQuestionsLoading(true);
    const params: Record<string, string> = {};
    api
      .get("/exam-questions", { params })
      .then((res) => {
        const list = Array.isArray(res?.data?.questions) ? res.data.questions : [];
        setQuestions(list);
      })
      .catch(() => setQuestions([]))
      .finally(() => setQuestionsLoading(false));
  }, []);

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

  const updateQuestionItems = (items: WorksheetItem[]) => {
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

  if (loadError) {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <p style={{ color: "#b91c1c", marginBottom: "1rem" }}>{loadError}</p>
        <button type="button" onClick={() => navigate("/teacher")} style={{ padding: "8px 16px" }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Worksheet Builder</h1>
        <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed"}
        </span>
      </div>

      <div
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
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
            {questionsLoading ? (
              <p style={{ color: "#6b7280" }}>Loading questions…</p>
            ) : bankList.length === 0 ? (
              <p style={{ color: "#6b7280" }}>No questions in this topic.</p>
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
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "12px",
                        marginBottom: "12px",
                        background: "#fff",
                        position: "relative",
                      }}
                    >
                      <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "4px" }}>
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
