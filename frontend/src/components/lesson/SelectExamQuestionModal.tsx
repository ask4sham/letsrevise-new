/**
 * Select an Exam Question Bank item to embed in a lesson block (reference by id only).
 */
import React, { useEffect, useMemo, useState } from "react";
import { fetchExamQuestionsList, type ExamQuestion } from "../../api/examQuestions";
import { getTaxonomyOptionGroups, type TaxonomyResponse } from "../../api/taxonomy";
import { makeAbsoluteAssetUrl } from "../../utils/assetUrl";

const QUESTION_TYPES = ["mcq", "short", "label", "table", "data"] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (question: ExamQuestion) => void;
  taxonomy: TaxonomyResponse | null;
  defaultSubject?: string;
  defaultExamBoard?: string;
  defaultLevel?: string;
  defaultTopicKey?: string;
  defaultSpecKey?: string;
};

export function SelectExamQuestionModal({
  isOpen,
  onClose,
  onSelect,
  taxonomy,
  defaultSubject = "",
  defaultExamBoard = "",
  defaultLevel = "",
  defaultTopicKey = "",
  defaultSpecKey = "",
}: Props) {
  const [subject, setSubject] = useState(defaultSubject);
  const [examBoard, setExamBoard] = useState(defaultExamBoard);
  const [level, setLevel] = useState(defaultLevel);
  const [topicKey, setTopicKey] = useState(defaultTopicKey);
  const [questionType, setQuestionType] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSpecKey = useMemo(() => {
    const fromProp = defaultSpecKey.trim();
    if (fromProp) return fromProp;
    const tk = defaultTopicKey.trim();
    if (tk.includes(":")) return tk.split(":")[0] ?? "";
    return "";
  }, [defaultSpecKey, defaultTopicKey]);

  const topicOptionGroups = useMemo(() => getTaxonomyOptionGroups(taxonomy), [taxonomy]);

  useEffect(() => {
    if (!isOpen) return;
    setSubject(defaultSubject);
    setExamBoard(defaultExamBoard);
    setLevel(defaultLevel);
    setTopicKey(defaultTopicKey);
  }, [isOpen, defaultSubject, defaultExamBoard, defaultLevel, defaultTopicKey]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchExamQuestionsList({
          subject: subject.trim() || undefined,
          examBoard: examBoard.trim() || undefined,
          level: level.trim() || undefined,
          topicKey: topicKey.trim() || undefined,
          specKey: resolvedSpecKey || undefined,
          type: questionType.trim() || undefined,
          status: status.trim() || undefined,
          mineOnly: true,
          limit: 100,
          q: search.trim() || undefined,
        });
        if (!cancelled) setItems(res.questions ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load questions");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, subject, examBoard, level, topicKey, questionType, status, search, resolvedSpecKey]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-exam-question-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10050,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(920px, 100%)",
          maxHeight: "min(88vh, 900px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <h2 id="select-exam-question-title" style={{ margin: 0, fontSize: "1.125rem" }}>
            Select from Exam Question Bank
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
            The lesson stores a reference only — edits in the bank appear here automatically.
          </p>
        </div>

        <div style={{ padding: "12px 20px", borderBottom: "1px solid #f3f4f6", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question text…"
              style={{ flex: "1 1 200px", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            />
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            />
            <input
              value={examBoard}
              onChange={(e) => setExamBoard(e.target.value)}
              placeholder="Exam board"
              style={{ width: 120, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            />
            <input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Level"
              style={{ width: 100, padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            />
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="">All types</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
            >
              <option value="">Draft + published</option>
              <option value="draft">Draft only</option>
              <option value="published">Published only</option>
            </select>
          </div>
          <select
            value={topicKey}
            onChange={(e) => setTopicKey(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="">All topics</option>
            {topicOptionGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.topics.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.topic}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>
          {loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
          {error && <p style={{ color: "#dc2626" }}>{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p style={{ color: "#6b7280" }}>No questions match your filters.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((q) => (
              <button
                key={q._id}
                type="button"
                onClick={() => onSelect(q)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6, fontSize: 12, color: "#6b7280" }}>
                  {q.status === "draft" && <span style={{ fontWeight: 700, color: "#b45309" }}>Draft</span>}
                  {q.marks != null && <span>{q.marks} marks</span>}
                  {q.type && <span>{q.type}</span>}
                  {q.topic && <span>{q.topic}</span>}
                </div>
                {q.imageUrl ? (
                  <img
                    src={makeAbsoluteAssetUrl(String(q.imageUrl).trim()) ?? ""}
                    alt=""
                    style={{
                      maxHeight: 80,
                      maxWidth: 160,
                      objectFit: "contain",
                      borderRadius: 6,
                      border: "1px solid #e5e7eb",
                      marginBottom: 8,
                      display: "block",
                    }}
                  />
                ) : null}
                <div style={{ color: "#111827", whiteSpace: "pre-wrap" }}>
                  {String(q.question ?? "").slice(0, 280)}
                  {String(q.question ?? "").length > 280 ? "…" : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
