import React, { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import { SpecSelector } from "../SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../../utils/specKey";
import { useTaxonomy } from "../../hooks/useTaxonomy";
import { getTaxonomyOptionGroups, type SpecKey } from "../../api/taxonomy";

export type CreateLessonPracticePanelProps = {
  /** Server lesson id once a draft has been saved */
  lessonId: string | null;
  /** When set, practice bank uses the same spec as the lesson syllabus picker */
  lessonSpecKey?: string;
  /** Show spinner on parent while creating draft */
  parentEnsuring?: boolean;
  /** Create draft lesson if needed; returns id or error message */
  ensureLessonId: () => Promise<{ ok: true; id: string } | { ok: false; message: string }>;
};

type AttachedQ = { _id: string; question: string; type?: string; marks?: number; topicKey?: string; topic?: string };

/**
 * Practice / exam-question controls matching Edit lesson left rail (question bank + auto-attach).
 * Requires a persisted lesson id — parent supplies ensureLessonId() which POSTs a draft when needed.
 */
export function CreateLessonPracticePanel({
  lessonId,
  lessonSpecKey,
  parentEnsuring = false,
  ensureLessonId,
}: CreateLessonPracticePanelProps) {
  const [specKey, setSpecKey] = useState<SpecKey>(
    (lessonSpecKey as SpecKey) || getStoredSpecKey()
  );
  const { data: taxonomyData } = useTaxonomy(specKey);
  const taxonomyUnits = Array.isArray(taxonomyData?.units) ? taxonomyData!.units : [];

  const [addFromBankModalOpen, setAddFromBankModalOpen] = useState(false);
  const [bankTopicKey, setBankTopicKey] = useState("");
  const [bankQuestions, setBankQuestions] = useState<AttachedQ[]>([]);
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<Set<string>>(new Set());
  const [attachedExamQuestions, setAttachedExamQuestions] = useState<AttachedQ[]>([]);
  const [autoAttachLoading, setAutoAttachLoading] = useState(false);
  const [autoAttachMessage, setAutoAttachMessage] = useState<string | null>(null);
  const [autoAttachLimit, setAutoAttachLimit] = useState(10);
  const [localError, setLocalError] = useState<string | null>(null);
  /** Id returned from last ensure (parent state may lag one frame) */
  const [activeLessonIdForModal, setActiveLessonIdForModal] = useState<string | null>(null);

  useEffect(() => {
    if (lessonSpecKey && lessonSpecKey !== specKey) {
      setSpecKey(lessonSpecKey as SpecKey);
      setStoredSpecKey(lessonSpecKey as SpecKey);
      setBankTopicKey("");
    }
  }, [lessonSpecKey, specKey]);

  const onSpecChange = useCallback((v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setBankTopicKey("");
  }, []);

  const refreshAttached = useCallback(async (id: string) => {
    try {
      const listRes = await api.get(`/lessons/${id}/exam-questions`);
      setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
    } catch {
      setAttachedExamQuestions([]);
    }
  }, []);

  useEffect(() => {
    if (!lessonId) {
      setAttachedExamQuestions([]);
      return;
    }
    refreshAttached(lessonId);
  }, [lessonId, refreshAttached]);

  useEffect(() => {
    if (!addFromBankModalOpen) return;
    if (!bankTopicKey) {
      setBankQuestions([]);
      return;
    }
    api
      .get("/exam-questions", { params: { topicKey: bankTopicKey } })
      .then((res: { data?: { questions?: AttachedQ[] } }) => {
        setBankQuestions(Array.isArray(res?.data?.questions) ? res.data!.questions! : []);
      })
      .catch(() => setBankQuestions([]));
  }, [addFromBankModalOpen, bankTopicKey]);

  const openBankModal = async () => {
    setLocalError(null);
    const ensured = await ensureLessonId();
    if (ensured.ok === false) {
      setLocalError(ensured.message);
      return;
    }
    setActiveLessonIdForModal(ensured.id);
    setAddFromBankModalOpen(true);
    setBankTopicKey("");
    setBankQuestions([]);
    setSelectedBankQuestionIds(new Set());
  };

  const runAutoAttach = async () => {
    setLocalError(null);
    setAutoAttachMessage(null);
    const ensured = await ensureLessonId();
    if (ensured.ok === false) {
      setLocalError(ensured.message);
      return;
    }
    const id = ensured.id;
    setAutoAttachLoading(true);
    try {
      const res = await api.post(`/lessons/${id}/exam-questions/attach-by-topic`, { limit: autoAttachLimit });
      const data = res?.data as { added?: number; topic?: string; warning?: string } | undefined;
      const added = data?.added ?? 0;
      const topicName = data?.topic ?? "topic";
      if (added > 0) await refreshAttached(id);
      const msg =
        data?.warning ?? (added > 0 ? `Added ${added} question${added !== 1 ? "s" : ""} for ${topicName}` : "No new questions to add.");
      setAutoAttachMessage(msg);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { msg?: string; error?: string } } };
      setAutoAttachMessage(e?.response?.data?.msg ?? e?.response?.data?.error ?? "Failed to attach.");
    } finally {
      setAutoAttachLoading(false);
      setTimeout(() => setAutoAttachMessage(null), 5000);
    }
  };

  const busy = parentEnsuring;

  return (
    <>
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1.5px solid rgba(15,23,42,0.14)",
          background: "rgba(248,250,252,0.5)",
          borderRadius: 10,
          padding: 10,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6, fontSize: "0.85rem", color: "#0f172a" }}>
          Practice questions (exam)
        </div>
        <p style={{ margin: "0 0 8px", fontSize: "0.72rem", color: "#64748b", lineHeight: 1.45 }}>
          Same as Edit lesson: attach from the question bank or auto-attach by topic. Saves a draft lesson first if needed.
        </p>
        {localError && (
          <div style={{ marginBottom: 8, fontSize: "0.72rem", color: "#b91c1c", lineHeight: 1.4 }}>{localError}</div>
        )}
        {lessonId && (
          <div style={{ fontSize: "0.68rem", color: "#059669", marginBottom: 8, fontWeight: 600 }}>
            Draft saved — practice is linked to this lesson.
          </div>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void openBankModal()}
          style={{
            ...toolBtn,
            opacity: busy ? 0.65 : 1,
            cursor: busy ? "not-allowed" : "pointer",
            marginBottom: 6,
          }}
        >
          Add from Question Bank
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy || autoAttachLoading}
            onClick={() => void runAutoAttach()}
            style={{
              ...toolBtn,
              border: "2px solid rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.08)",
              opacity: busy || autoAttachLoading ? 0.65 : 1,
              cursor: busy || autoAttachLoading ? "not-allowed" : "pointer",
            }}
          >
            {autoAttachLoading ? "Attaching…" : `Auto-attach (top ${autoAttachLimit})`}
          </button>
          <select
            value={autoAttachLimit}
            onChange={(e) => setAutoAttachLimit(Number(e.target.value))}
            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 12, fontWeight: 600 }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
        </div>
        {autoAttachMessage && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 10px",
              borderRadius: 8,
              fontSize: 12,
              background: autoAttachMessage.startsWith("Added")
                ? "#dcfce7"
                : autoAttachMessage.includes("limited") || autoAttachMessage.includes("exact-match")
                  ? "#fef3c7"
                  : "#fee2e2",
              color: autoAttachMessage.startsWith("Added")
                ? "#166534"
                : autoAttachMessage.includes("limited") || autoAttachMessage.includes("exact-match")
                  ? "#92400e"
                  : "#b91c1c",
            }}
          >
            {autoAttachMessage}
          </div>
        )}
        {attachedExamQuestions.length > 0 && (
          <ul style={{ marginTop: 10, paddingLeft: 18, listStyle: "disc", marginBottom: 0 }}>
            {attachedExamQuestions.map((q) => (
              <li key={q._id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }} title={q.question}>
                  {q.question?.slice(0, 52)}
                  {(q.question?.length ?? 0) > 52 ? "…" : ""}{" "}
                  {q.marks != null ? `(${q.marks}m)` : ""}
                </span>
                {lessonId ? (
                  <button
                    type="button"
                    onClick={() =>
                      api
                        .delete(`/lessons/${lessonId}/exam-questions/${q._id}`)
                        .then(() => setAttachedExamQuestions((prev) => prev.filter((x) => x._id !== q._id)))
                        .catch(() => {})
                    }
                    style={{
                      padding: "2px 6px",
                      fontSize: 10,
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      borderRadius: 6,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {addFromBankModalOpen && (lessonId || activeLessonIdForModal) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: 20,
          }}
          onClick={() => {
            setAddFromBankModalOpen(false);
            setActiveLessonIdForModal(null);
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 20,
              maxWidth: 520,
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Add from Question Bank</div>
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 10 }}>
              Only questions for the selected sub-topic will be shown.
            </div>
            <div style={{ marginBottom: 10 }}>
              <SpecSelector value={specKey} onChange={onSpecChange} />
            </div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Topic</label>
            <select
              value={bankTopicKey}
              onChange={(e) => setBankTopicKey(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "2px solid #e2e8f0", marginBottom: 14 }}
            >
              <option value="">— Select topic —</option>
              {getTaxonomyOptionGroups({ units: taxonomyUnits }).map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.topics.map((t) => (
                    <option key={`${g.label}:${t.key}`} value={t.key}>
                      {t.topic}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {bankTopicKey && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Questions</div>
                <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                  {bankQuestions.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>No questions with this topic.</div>
                  ) : (
                    bankQuestions.map((q) => (
                      <label
                        key={q._id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "8px 0",
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBankQuestionIds.has(q._id)}
                          onChange={(e) => {
                            setSelectedBankQuestionIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(q._id);
                              else next.delete(q._id);
                              return next;
                            });
                          }}
                        />
                        <span style={{ fontSize: 13, color: "#374151" }}>
                          {q.question?.slice(0, 80)}
                          {(q.question?.length ?? 0) > 80 ? "…" : ""} {q.marks != null ? `(${q.marks})` : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const lid = lessonId || activeLessonIdForModal;
                      if (!lid || selectedBankQuestionIds.size === 0) return;
                      api
                        .post(`/lessons/${lid}/exam-questions`, { questionIds: Array.from(selectedBankQuestionIds) })
                        .then((res: { data?: { added?: number } }) => {
                          const added = res?.data?.added ?? 0;
                          if (added > 0) {
                            api.get(`/lessons/${lid}/exam-questions`).then((r: { data?: { questions?: AttachedQ[] } }) => {
                              setAttachedExamQuestions(Array.isArray(r?.data?.questions) ? r.data!.questions! : []);
                            });
                          }
                          setAddFromBankModalOpen(false);
                          setActiveLessonIdForModal(null);
                        })
                        .catch(() => {});
                    }}
                    disabled={selectedBankQuestionIds.size === 0}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: selectedBankQuestionIds.size > 0 ? "#4f46e5" : "#e5e7eb",
                      color: selectedBankQuestionIds.size > 0 ? "white" : "#9ca3af",
                      fontWeight: 700,
                      cursor: selectedBankQuestionIds.size > 0 ? "pointer" : "not-allowed",
                    }}
                  >
                    Attach to lesson
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddFromBankModalOpen(false);
                      setActiveLessonIdForModal(null);
                    }}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "2px solid #e2e8f0",
                      background: "white",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const toolBtn: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "2px solid rgba(59,130,246,0.4)",
  background: "rgba(59,130,246,0.08)",
  fontWeight: 700,
  fontSize: "0.75rem",
  color: "#0f172a",
  boxSizing: "border-box",
};
