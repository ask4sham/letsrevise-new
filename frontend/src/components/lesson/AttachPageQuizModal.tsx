/**
 * Attach page quiz from Topic Quiz Bank.
 * Shows published TopicQuizQuestion for exact lesson.topicKey.
 * Multi-select, confirm attach → writes to lesson.quiz.questions with pageId.
 */
import React, { useEffect, useState } from "react";
import { listTopicQuizQuestions, attachPageQuizFromBank } from "../../api/topicQuizQuestions";
import type { TopicQuizQuestion } from "../../api/topicQuizQuestions";

export function AttachPageQuizModal(props: {
  open: boolean;
  onClose: () => void;
  lessonId: string;
  topicKey: string;
  pageId: string;
  pageTitle?: string;
  alreadyAttachedSourceIds: string[];
  onAttachSuccess: (lesson: any, result?: { addedCount: number; alreadyExisted: number }) => void;
}) {
  const { open, onClose, lessonId, topicKey, pageId, pageTitle, alreadyAttachedSourceIds, onAttachSuccess } = props;

  const [items, setItems] = useState<TopicQuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    if (!open || !topicKey?.trim()) return;
    setError(null);
    setSelected(new Set());
    const load = async () => {
      setLoading(true);
      try {
        const list = await listTopicQuizQuestions(topicKey, {
          status: "published",
          kind: "quiz",
          exactMatch: true,
          forAttach: true,
        });
        setItems(list);
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || "Failed to load questions");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, topicKey]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const available = items.filter((q) => !alreadyAttachedSourceIds.includes(String(q._id)));
    setSelected(new Set(available.map((q) => String(q._id))));
  };

  const handleAttach = async () => {
    if (selected.size === 0) return;
    setAttaching(true);
    try {
      const result = await attachPageQuizFromBank(lessonId, pageId, Array.from(selected));
      onAttachSuccess(result.lesson, { addedCount: result.addedCount, alreadyExisted: result.alreadyExisted });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.msg || e?.message || "Attach failed");
    } finally {
      setAttaching(false);
    }
  };

  const available = items.filter((q) => !alreadyAttachedSourceIds.includes(String(q._id)));

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: 560,
          width: "90%",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: 20, borderBottom: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Attach Quiz Page From Question Bank</h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
            Attach published quiz questions from the Topic Quiz Bank to this page.
          </p>
          {pageTitle && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>
              Page: {pageTitle}
            </p>
          )}
        </div>

        <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
          {loading && <p style={{ color: "#6b7280", margin: 0 }}>Loading questions…</p>}
          {error && <p style={{ color: "#dc2626", margin: "0 0 12px" }}>{error}</p>}
          {!loading && items.length === 0 && !error && (
            <p style={{ color: "#6b7280", margin: 0 }}>
              No published quiz questions for this topic. Add and publish questions in Question Banks first.
            </p>
          )}
          {!loading && items.length > 0 && (
            <>
              <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    background: "#f9fafb",
                    cursor: "pointer",
                  }}
                >
                  Select all available
                </button>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {available.length} available · {alreadyAttachedSourceIds.length} already on page
                </span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {items.map((q) => {
                  const id = String(q._id);
                  const isAttached = alreadyAttachedSourceIds.includes(id);
                  const isSel = selected.has(id);
                  const typeLabel = String(q.type || "mcq").toLowerCase().includes("short") ? "Short answer" : "MCQ";
                  const answerPreview =
                    String(q.type || "").toLowerCase().includes("short")
                      ? (q.acceptableAnswers?.[0] || "—")
                      : (Array.isArray(q.choices) && q.choices[q.correctIndex ?? 0]) || "—";
                  return (
                    <li
                      key={id}
                      style={{
                        padding: 8,
                        border: `1px solid ${isSel ? "#2563eb" : "#e5e7eb"}`,
                        borderRadius: 8,
                        background: isAttached ? "#f9fafb" : isSel ? "#eff6ff" : "#fff",
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: isAttached ? "default" : "pointer", width: "100%" }}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          disabled={isAttached}
                          onChange={() => !isAttached && toggle(id)}
                          style={{
                            marginTop: 2,
                            flexShrink: 0,
                            width: 14,
                            height: 14,
                            minWidth: 14,
                            minHeight: 14,
                            transform: "scale(0.65)",
                            transformOrigin: "left center",
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 120, wordBreak: "break-word", overflowWrap: "break-word" }}>
                          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                            {typeLabel} · Answer: {String(answerPreview).slice(0, 60)}
                            {String(answerPreview).length > 60 ? "…" : ""}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{q.questionText || "—"}</div>
                          {isAttached && (
                            <span style={{ fontSize: 11, color: "#059669", marginTop: 4, display: "inline-block" }}>
                              Already on this page
                            </span>
                          )}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAttach}
            disabled={selected.size === 0 || attaching}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              border: "none",
              borderRadius: 8,
              background: selected.size > 0 && !attaching ? "#2563eb" : "#9ca3af",
              color: "#fff",
              cursor: selected.size > 0 && !attaching ? "pointer" : "not-allowed",
            }}
          >
            {attaching ? "Attaching…" : `Attach ${selected.size} question${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
