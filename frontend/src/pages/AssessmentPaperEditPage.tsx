import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [patching, setPatching] = useState(false);

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

  const loadBankQuestions = async () => {
    try {
      setBankLoading(true);
      const res = await api.get("/exam-questions");
      const raw = res.data?.questions ?? res.data?.data ?? res.data;
      const list = Array.isArray(raw) ? raw : [];
      setBankQuestions(list);
      setSelectedIds(new Set());
    } catch (err) {
      setBankQuestions([]);
    } finally {
      setBankLoading(false);
    }
  };

  const openBankModal = () => {
    setBankOpen(true);
    loadBankQuestions();
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
      });
      setBankOpen(false);
      const res = await api.get(`/assessment-papers/${paperId}`);
      setPaper(res.data?.paper || null);
    } catch (err: any) {
      alert(err?.message || "Failed to add questions");
    } finally {
      setPatching(false);
    }
  };

  const removeBankQuestion = async (examQuestionId: string) => {
    if (!paperId) return;
    try {
      setPatching(true);
      await api.patch(`/assessment-papers/${paperId}/questions`, {
        removeExamQuestionIds: [examQuestionId],
      });
      const res = await api.get(`/assessment-papers/${paperId}`);
      setPaper(res.data?.paper || null);
    } catch (err: any) {
      alert(err?.message || "Failed to remove question");
    } finally {
      setPatching(false);
    }
  };

  const attachedBankIds = new Set(paper?.questionBankIds || []);

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
            {bankLoading ? (
              <p>Loading…</p>
            ) : (
              <>
                <div
                  className="text-left"
                  style={{ textAlign: "left", marginBottom: "1rem", maxHeight: "80vh", overflow: "auto" }}
                >
                  {bankQuestions.length === 0 ? (
                    <p style={{ color: "#6b7280" }}>No questions in your bank.</p>
                  ) : (
                    <div>
                      {bankQuestions.map((q) => {
                        const qId = q._id != null ? String(q._id) : "";
                        const alreadyOnPaper = attachedBankIds.has(qId);
                        const selected = selectedIds.has(qId);
                        const qText = (q.question != null && typeof q.question === "string" ? q.question : "").trim();
                        const topicText = (q.topic != null && typeof q.topic === "string" ? q.topic : "").trim();
                        const primaryText = qText || topicText || "(No question text)";
                        const typeStr = q.type != null ? String(q.type) : "question";
                        const marksNum = q.marks != null ? Number(q.marks) : 1;
                        const secondaryText = `${typeStr} • ${marksNum} mark${marksNum !== 1 ? "s" : ""}`;
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
                            style={{
                              padding: "0.75rem",
                              borderBottom: "1px solid #e5e7eb",
                              background: "white",
                            }}
                          >
                            <div className="grid grid-cols-[1fr_48px] items-start w-full">
                              <div className="text-left">
                                <div
                                  className="font-medium text-gray-900"
                                  style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.5 }}
                                >
                                  {primaryText}
                                </div>

                                <div className="text-gray-500" style={{ fontSize: "0.95rem", fontWeight: 500 }}>
                                  {secondaryText}
                                  {alreadyOnPaper && (
                                    <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#059669" }}>
                                      (on paper)
                                    </span>
                                  )}
                                </div>
                                
                                {optionsPreview != null && (
                                  <div style={{ marginTop: "0.25rem", fontSize: "0.8rem", color: "#111" }}>
                                    {optionsPreview}
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-end pt-1">
                                <input
                                  id={`bank-q-${qId}`}
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleBankSelection(qId)}
                                  disabled={alreadyOnPaper}
                                  style={{
                                    appearance: "auto",
                                    width: 16,
                                    height: 16,
                                    background: "none",
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
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
                      cursor: selectedIds.size === 0 || patching ? "not-allowed" : "pointer",
                    }}
                  >
                    {patching ? "Adding…" : `Add ${selectedIds.size} to paper`}
                  </button>
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