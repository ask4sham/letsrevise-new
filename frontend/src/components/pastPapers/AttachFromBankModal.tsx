/**
 * PR-PAST-PAPERS-UI-3: Attach from exam question bank — search, filter by topic, multi-select, optional question numbers.
 * PR-METADATA-1: Filter by difficulty and skill.
 */
import React, { useMemo, useState } from "react";
import { fetchMyExamQuestions, attachFromBank, type ExamQuestion } from "../../api/examQuestions";
import { getUnitTopics, type TaxonomyResponse } from "../../api/taxonomy";
import { DifficultySkillFilter, type DifficultySkillFilterValues } from "../filters/DifficultySkillFilter";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  specKey: string;
  pastPaperId: string;
  taxonomy: TaxonomyResponse | null;
  onAttached: () => Promise<void>;
};

export function AttachFromBankModal({
  isOpen,
  onClose,
  token,
  specKey,
  pastPaperId,
  taxonomy,
  onAttached,
}: Props) {
  const [selectedUnitName, setSelectedUnitName] = useState("");
  const [topicKey, setTopicKey] = useState("");
  const [q, setQ] = useState("");
  const [filterValues, setFilterValues] = useState<DifficultySkillFilterValues>({});
  const [items, setItems] = useState<ExamQuestion[]>([]);
  const [selected, setSelected] = useState<Record<string, { questionNumber?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const units = taxonomy?.units ?? [];
  const selectedUnit = useMemo(
    () => units.find((u) => u.unit === selectedUnitName) ?? units[0],
    [units, selectedUnitName]
  );
  const topics = getUnitTopics(selectedUnit);

  if (!isOpen) return null;

  async function runSearch() {
    setLoading(true);
    try {
      const res = await fetchMyExamQuestions({
        token,
        specKey,
        topicKey: topicKey || undefined,
        q: q.trim() || undefined,
        limit: 100,
        difficulty: filterValues.difficulty ?? undefined,
        difficultyMin: filterValues.difficultyMin ?? undefined,
        difficultyMax: filterValues.difficultyMax ?? undefined,
        skill: filterValues.skill ? String(filterValues.skill) : undefined,
      });
      setItems(res.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function doAttach() {
    const ids = Object.keys(selected);
    if (!ids.length) return;

    setAttaching(true);
    try {
      await attachFromBank({
        token,
        pastPaperId,
        examQuestionIds: ids,
        overrides: ids.map((id) => ({
          examQuestionId: id,
          questionNumber: selected[id]?.questionNumber,
        })),
      });
      await onAttached();
      setSelected({});
      onClose();
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Attach from exam question bank</div>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          Attach your teacher-authored bank questions to this paper. (No official exam-board content is provided.)
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Collection</label>
              <select
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={selectedUnitName}
                onChange={(e) => {
                  setSelectedUnitName(e.target.value);
                  setTopicKey("");
                }}
              >
                <option value="">All</option>
                {units.map((u) => (
                  <option key={u.unit} value={u.unit}>
                    {u.unit}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Topic</label>
              <select
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={topicKey}
                onChange={(e) => setTopicKey(e.target.value)}
              >
                <option value="">All</option>
                {topics.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.topic}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Search</label>
              <input
                type="text"
                placeholder="Search question text…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 4 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Difficulty & skill</label>
            <DifficultySkillFilter values={filterValues} onChange={setFilterValues} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Searching…" : "Search bank"}
            </button>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb", fontSize: 14, fontWeight: 600 }}>Results</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {items.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>No results. Try searching.</div>
              ) : (
                items.map((it) => {
                  const isChecked = !!selected[it._id];
                  return (
                    <div
                      key={it._id}
                      style={{
                        padding: 12,
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelected((s) => ({ ...s, [it._id]: { questionNumber: "" } }));
                            } else {
                              setSelected((s) => {
                                const next = { ...s };
                                delete next[it._id];
                                return next;
                              });
                            }
                          }}
                          style={{ marginTop: 4 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14 }}>
                            {it.marks != null ? (
                              <span style={{ color: "#6b7280", marginRight: 8 }}>({it.marks} marks)</span>
                            ) : null}
                            <span style={{ display: "block", marginTop: 2 }}>
                              {it.question.length > 120 ? it.question.slice(0, 120) + "…" : it.question}
                            </span>
                          </div>
                          {isChecked ? (
                            <div style={{ marginTop: 8 }}>
                              <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                                Question number (optional)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 3(b)"
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 6,
                                  border: "1px solid #d1d5db",
                                  fontSize: 13,
                                }}
                                value={selected[it._id]?.questionNumber ?? ""}
                                onChange={(e) =>
                                  setSelected((s) => ({ ...s, [it._id]: { questionNumber: e.target.value } }))
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={attaching}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontSize: 14,
              cursor: attaching ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={doAttach}
            disabled={attaching || Object.keys(selected).length === 0}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: 14,
              cursor: attaching || Object.keys(selected).length === 0 ? "not-allowed" : "pointer",
              opacity: attaching || Object.keys(selected).length === 0 ? 0.6 : 1,
            }}
          >
            {attaching ? "Attaching…" : `Attach selected (${Object.keys(selected).length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
