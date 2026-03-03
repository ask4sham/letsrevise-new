import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { getSpecKeyFromLesson } from "../utils/resolveLessonTopicKey";
import type { SpecKey } from "../api/taxonomy";

type PaperItem = {
  _id: string;
  itemId?: string;
  title?: string;
  question?: string;
  type?: string;
  options?: string[];
  marks?: number;
  order?: number;
  source?: "bank";
};

type Paper = {
  _id: string;
  title: string;
  subject?: string;
  examBoard?: string;
  level?: string;
  topicKey?: string;
  items?: PaperItem[];
  questionBankIds?: string[];
};

type BankQuestion = {
  _id: string;
  subject?: string;
  topic?: string;
  type: string;
  question?: string;
  marks: number;
  options?: string[];
};

const AssessmentPaperEditPage: React.FC = () => {
  const { id: paperId } = useParams<{ id: string }>();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankPage, setBankPage] = useState(1);
  const [bankTotal, setBankTotal] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [patching, setPatching] = useState(false);
  const [modalTopicKey, setModalTopicKey] = useState("");
  const [bankSpecKey, setBankSpecKey] = useState<SpecKey>(() => getStoredSpecKey());
  const { data: taxonomy } = useTaxonomy(bankSpecKey);

  const paperSpecKey = getSpecKeyFromLesson(paper ? { subject: paper.subject, level: paper.level, examBoardName: paper.examBoard } : null) as SpecKey | null;

  useEffect(() => {
    if (!paperId) return;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/assessment-papers/${paperId}`);
        setPaper(res.data?.paper || null);
      } catch (err: any) {
        setError(err?.message || "Failed to load paper");
        setPaper(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [paperId]);

  const DEFAULT_PAGE = 1;
  const DEFAULT_LIMIT = 50;

  const loadBankQuestions = useCallback(
    async (page: number = DEFAULT_PAGE, overrideTopicKey?: string) => {
      try {
        setBankLoading(true);
        const params: Record<string, string | number> = {
          page: String(page),
          limit: String(DEFAULT_LIMIT),
        };
        if (paper?.subject) params.subject = paper.subject;
        if (paper?.examBoard) params.examBoard = paper.examBoard;
        if (paper?.level) params.level = paper.level;
        const topicKeyToSend =
          overrideTopicKey !== undefined
            ? (overrideTopicKey && overrideTopicKey.trim()) || undefined
            : paper?.topicKey || (modalTopicKey && modalTopicKey.trim()) || undefined;
        if (topicKeyToSend) {
          params.topicKey = topicKeyToSend;
          params.specKey = bankSpecKey;
        }
        const res = await api.get("/exam-questions", { params });
        const list = Array.isArray(res.data?.questions) ? res.data.questions : [];
        const pagination = res.data?.pagination;
        if (pagination) {
          setBankTotal(pagination.total ?? null);
          setBankPage(page);
          if (page === 1) {
            setBankQuestions(list);
            setSelectedIds(new Set());
          } else {
            setBankQuestions((prev) => [...prev, ...list]);
          }
        } else {
          setBankTotal(null);
          setBankPage(1);
          setBankQuestions(list);
          if (page === 1) setSelectedIds(new Set());
        }
      } catch (err) {
        setBankQuestions((prev) => (page === 1 ? [] : prev));
        if (page === 1) setBankTotal(null);
      } finally {
        setBankLoading(false);
      }
    },
    [paper?.subject, paper?.examBoard, paper?.level, paper?.topicKey, modalTopicKey, bankSpecKey]
  );

  const openBankModal = () => {
    setBankOpen(true);
    setQuery("");
    const initialTopic = paper?.topicKey ?? "";
    setModalTopicKey(initialTopic);
    setBankPage(1);
    setBankTotal(null);
    if (paperSpecKey) setBankSpecKey(paperSpecKey);
    loadBankQuestions(1, initialTopic);
  };

  const handleBankSpecChange = (v: SpecKey) => {
    setBankSpecKey(v);
    setStoredSpecKey(v);
    setModalTopicKey("");
    setBankPage(1);
    loadBankQuestions(1, "");
  };

  const handleBankTopicChange = (topicKey: string) => {
    setModalTopicKey(topicKey);
    setBankPage(1);
    loadBankQuestions(1, topicKey);
  };

  const toggleBankSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addToPaper = async () => {
    if (!paperId || selectedIds.size === 0) return;
    try {
      setPatching(true);
      await api.patch(`/assessment-papers/${paperId}/questions`, {
        addExamQuestionIds: Array.from(selectedIds),
        removeExamQuestionIds: [],
      });
      setBankOpen(false);
      const res = await api.get(`/assessment-papers/${paperId}`);
      setPaper(res.data?.paper || null);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const data = err?.data ?? err?.response?.data;
      console.error("Add to paper failed:", { status, data, err });
      const msg =
        data?.error ||
        data?.msg ||
        data?.message ||
        (typeof data === "string" ? data : null) ||
        err?.message ||
        `Server error${status != null ? ` (${status})` : ""}`;
      alert(msg);
    } finally {
      setPatching(false);
    }
  };

  // Remove bank question: PATCH /api/assessment-papers/:id/questions { addExamQuestionIds: [], removeExamQuestionIds: [examQuestionId] }
  const removeBankQuestion = async (examQuestionId: string) => {
    if (!paperId) return;
    try {
      setPatching(true);
      await api.patch(`/assessment-papers/${paperId}/questions`, {
        addExamQuestionIds: [],
        removeExamQuestionIds: [examQuestionId],
      });
      try {
        const res = await api.get(`/assessment-papers/${paperId}`);
        setPaper(res.data?.paper || null);
      } catch (refetchErr: any) {
        // PATCH succeeded; update local state so the question disappears even if refetch fails
        const refetchRes = refetchErr?.response;
        console.warn("Remove succeeded but refetch failed:", refetchRes?.status, refetchRes?.data);
        if (paper) {
          setPaper({
            ...paper,
            questionBankIds: (paper.questionBankIds || []).filter((id) => String(id) !== examQuestionId),
            items: (paper.items || []).filter((item) => String(item._id) !== examQuestionId),
          });
        }
      }
    } catch (err: any) {
      // Interceptor rejects with { message, status, data }; raw axios has err.response
      const status = err?.status ?? err?.response?.status;
      const data = err?.data ?? err?.response?.data;
      console.error("Remove question failed:", { status, data, err });
      const msg =
        data?.error ||
        data?.msg ||
        data?.message ||
        (typeof data === "string" ? data : null) ||
        err?.message ||
        `Server error${status != null ? ` (${status})` : ""}`;
      alert(msg);
    } finally {
      setPatching(false);
    }
  };

  const attachedBankIds = new Set(
    (paper?.questionBankIds || []).map((id: unknown) => String(id))
  );

  if (loading) {
    return (
      <div style={{ padding: "2rem" }}>Loading paper…</div>
    );
  }
  if (error || !paper) {
    return (
      <div style={{ padding: "2rem" }}>
        <p style={{ color: "#991b1b" }}>{error || "Paper not found"}</p>
        <Link to="/assessments/papers">← Back to papers</Link>
      </div>
    );
  }

  const items = paper.items || [];

  return (
    <div style={{ padding: "1.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link to="/assessments/papers" style={{ color: "#4f46e5", textDecoration: "none" }}>
          ← Back to papers
        </Link>
      </div>
      <h1 style={{ marginBottom: "0.5rem" }}>{paper.title}</h1>
      {paper.subject && (
        <p style={{ color: "#6b7280", marginBottom: "1rem" }}>{paper.subject}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={openBankModal}
          style={{
            padding: "8px 16px",
            background: "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add from Question Bank
        </button>
      </div>

      <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "0.5rem" }}>
        Questions on this paper ({items.length})
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li
            key={item._id}
            style={{
              padding: "0.75rem 1rem",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              marginBottom: "0.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.5rem",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, color: "#374151" }}>
                {i + 1}. {item.title || item.question?.slice(0, 60) || "Question"}
              </span>
              <span style={{ marginLeft: "0.5rem", color: "#6b7280", fontSize: "0.85rem" }}>
                ({item.type} · {item.marks ?? 1} mark{item.marks !== 1 ? "s" : ""})
              </span>
              {item.source === "bank" && (
                <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#059669" }}>
                  From bank
                </span>
              )}
            </div>
            {item.source === "bank" && (
              <button
                type="button"
                onClick={() => removeBankQuestion(item._id)}
                disabled={patching}
                style={{
                  padding: "4px 10px",
                  fontSize: "0.85rem",
                  background: "#fef2f2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  cursor: patching ? "not-allowed" : "pointer",
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p style={{ color: "#6b7280" }}>No questions yet. Add from Question Bank or add assessment items.</p>
      )}

      {bankOpen && (
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
          onClick={() => setBankOpen(false)}
        >
          <div
            style={{
              width: "72vw",
              maxWidth: "880px",
              maxHeight: "80vh",
              overflow: "auto",
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 1rem" }}>Add from Question Bank</h2>
            {!paper?.topicKey && (
              <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                <SpecSelector value={bankSpecKey} onChange={handleBankSpecChange} />
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Topic:</label>
                <select
                  value={modalTopicKey}
                  onChange={(e) => handleBankTopicChange(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", minWidth: "220px" }}
                >
                  <option value="">All topics</option>
                  {taxonomy?.units?.map((u) => (
                    <optgroup key={u.unit} label={u.unit}>
                      {(u.topics || []).map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.topic}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
            {bankLoading ? (
              <p>Loading…</p>
            ) : (
              <>
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Search questions (text, topic, type)…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 36px 10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        fontSize: "1rem",
                      }}
                    />
                    {query.trim() && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "1.25rem",
                          color: "#6b7280",
                          padding: "0 4px",
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "left",
                    marginBottom: "1rem",
                    maxHeight: "50vh",
                    overflow: "auto",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                >
                  {bankQuestions.length === 0 ? (
                    <p style={{ color: "#6b7280", padding: "1rem" }}>No questions in your bank.</p>
                  ) : (() => {
                    const q = query.trim().toLowerCase();
                    const filtered = q
                      ? bankQuestions.filter(
                          (x) =>
                            (x.question || "").toLowerCase().includes(q) ||
                            (x.topic || "").toLowerCase().includes(q) ||
                            (x.type || "").toLowerCase().includes(q)
                        )
                      : bankQuestions;
                    if (filtered.length === 0) {
                      return (
                        <div style={{ padding: "1.5rem", textAlign: "center", color: "#6b7280" }}>
                          <p style={{ margin: "0 0 0.25rem", fontWeight: 600 }}>No questions match your search.</p>
                          <p style={{ margin: 0, fontSize: "0.9rem" }}>Try a different keyword.</p>
                        </div>
                      );
                    }
                    return (
                      <div>
                        {filtered.map((q) => {
                          const qId = q._id != null ? String(q._id) : "";
                          const alreadyOnPaper = attachedBankIds.has(qId);
                          const selected = selectedIds.has(qId);
                          const qText = (q.question != null && typeof q.question === "string" ? q.question : "").trim();
                          const topicText = (q.topic != null && typeof q.topic === "string" ? q.topic : "").trim();
                          const primaryText = qText || topicText || "(No question text)";
                          const typeStr = q.type != null ? String(q.type) : "question";
                          const marksNum = q.marks != null ? Number(q.marks) : 1;
                          const secondaryText = `${typeStr} • ${marksNum} mark${marksNum !== 1 ? "s" : ""}${topicText ? ` • ${topicText}` : ""}${alreadyOnPaper ? " • (on paper)" : ""}`;
                          const opts = Array.isArray(q.options) ? q.options : [];
                          const optionsPreview =
                            typeStr === "mcq" && opts.length > 0
                              ? opts
                                  .slice(0, 5)
                                  .map(
                                    (o, i) =>
                                      `${String.fromCharCode(65 + i)}: ${(o != null ? String(o) : "").slice(0, 40)}${(o != null ? String(o) : "").length > 40 ? "…" : ""}`
                                  )
                                  .join("  ·  ")
                              : null;
                          return (
                            <div
                              key={qId}
                              role="button"
                              tabIndex={0}
                              onClick={() => !alreadyOnPaper && toggleBankSelection(qId)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (!alreadyOnPaper) toggleBankSelection(qId);
                                }
                              }}
                              style={{
                                padding: "0.75rem 1rem",
                                borderBottom: "1px solid #e5e7eb",
                                background: selected ? "#eef2ff" : "white",
                                cursor: alreadyOnPaper ? "default" : "pointer",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "12px",
                              }}
                              onMouseEnter={(e) => {
                                if (!alreadyOnPaper) e.currentTarget.style.background = selected ? "#e0e7ff" : "#f9fafb";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = selected ? "#eef2ff" : "white";
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={alreadyOnPaper}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (!alreadyOnPaper) toggleBankSelection(qId);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: 18,
                                  height: 18,
                                  marginTop: "2px",
                                  flexShrink: 0,
                                  pointerEvents: "auto",
                                  position: "relative",
                                  zIndex: 9999,
                                }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: "1rem",
                                    fontWeight: 600,
                                    color: "#111827",
                                    lineHeight: 1.4,
                                  }}
                                >
                                  {primaryText}
                                </div>
                                <div
                                  style={{
                                    marginTop: "4px",
                                    fontSize: "0.875rem",
                                    color: "#6b7280",
                                  }}
                                >
                                  {secondaryText}
                                </div>
                                {optionsPreview != null && (
                                  <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "#374151" }}>
                                    {optionsPreview}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                {bankTotal != null && (
                  <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: "0 0 0.5rem 0" }}>
                    Showing {bankQuestions.length} of {bankTotal} questions
                    {bankPage * DEFAULT_LIMIT < bankTotal && (
                      <button
                        type="button"
                        onClick={() => loadBankQuestions(bankPage + 1)}
                        disabled={bankLoading}
                        style={{
                          marginLeft: "12px",
                          padding: "4px 12px",
                          fontSize: "0.875rem",
                          background: "#eef2ff",
                          color: "#4f46e5",
                          border: "1px solid #c7d2fe",
                          borderRadius: "6px",
                          cursor: bankLoading ? "not-allowed" : "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Load more
                      </button>
                    )}
                  </p>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                    Selected: {selectedIds.size}
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => setBankOpen(false)}
                      style={{
                        padding: "8px 16px",
                        background: "white",
                        color: "#374151",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addToPaper}
                      disabled={selectedIds.size === 0 || patching}
                      style={{
                        padding: "8px 16px",
                        background: selectedIds.size === 0 || patching ? "#e5e7eb" : "#4f46e5",
                        color: selectedIds.size === 0 || patching ? "#9ca3af" : "white",
                        border: "none",
                        borderRadius: "8px",
                        fontWeight: 600,
                        cursor: selectedIds.size === 0 || patching ? "not-allowed" : "pointer",
                      }}
                    >
                      {patching ? "Adding…" : selectedIds.size > 0 ? `Add to paper (${selectedIds.size})` : "Add to paper"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentPaperEditPage;