/**
 * PR-PAST-PAPERS-UI-2: Manual add past paper question (teacher-authored only).
 * PR-METADATA-1: Optional difficulty, skill, estimatedTimeSec.
 */
import React, { useMemo, useState } from "react";
import { getUnitTopics, type TaxonomyResponse } from "../../api/taxonomy";
import { SKILLS, SKILL_LABELS, type Skill } from "../../constants/metadata";

export type AddPastPaperQuestionPayload = {
  topicKey: string;
  questionNumber?: string;
  marks?: number | null;
  question: string;
  markScheme: string;
  difficulty?: number | null;
  skill?: Skill | string | null;
  estimatedTimeSec?: number | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  taxonomy: TaxonomyResponse | null;
  onSubmit: (payload: AddPastPaperQuestionPayload) => Promise<void>;
};

export function AddPastPaperQuestionModal({ isOpen, onClose, taxonomy, onSubmit }: Props) {
  const [selectedUnitName, setSelectedUnitName] = useState<string>("");
  const [topicKey, setTopicKey] = useState<string>("");
  const [questionNumber, setQuestionNumber] = useState<string>("");
  const [marks, setMarks] = useState<string>("");
  const [question, setQuestion] = useState<string>("");
  const [markScheme, setMarkScheme] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [skill, setSkill] = useState<string>("");
  const [estimatedTimeSec, setEstimatedTimeSec] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const units = taxonomy?.units ?? [];
  const selectedUnit = useMemo(
    () => units.find((u) => u.unit === selectedUnitName) ?? units[0],
    [units, selectedUnitName]
  );
  const topics = getUnitTopics(selectedUnit);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!topicKey || !question.trim() || !markScheme.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        topicKey,
        questionNumber: questionNumber || undefined,
        marks: marks ? Number(marks) : null,
        question: question.trim(),
        markScheme: markScheme.trim(),
        difficulty: difficulty ? Math.min(5, Math.max(1, parseInt(difficulty, 10) || 0)) : null,
        skill: skill || null,
        estimatedTimeSec: estimatedTimeSec ? Math.max(1, parseInt(estimatedTimeSec, 10) || 0) : null,
      });
      setTopicKey("");
      setQuestionNumber("");
      setMarks("");
      setQuestion("");
      setMarkScheme("");
      setDifficulty("");
      setSkill("");
      setEstimatedTimeSec("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

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
          maxWidth: 560,
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Add question (teacher-authored)</div>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 16px" }}>
          Create an original question and link it to a topic for targeted practice.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                <option value="">Select collection</option>
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
                <option value="">Select topic</option>
                {topics.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.topic}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Question number</label>
              <input
                type="text"
                placeholder="e.g. 1(a)"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={questionNumber}
                onChange={(e) => setQuestionNumber(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Marks</label>
              <input
                type="text"
                placeholder="e.g. 2"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Difficulty (1–5)</label>
              <select
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">Optional</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Skill</label>
              <select
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
              >
                <option value="">Optional</option>
                {SKILLS.map((s) => (
                  <option key={s} value={s}>{SKILL_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Est. time (sec)</label>
              <input
                type="number"
                min={1}
                placeholder="Optional"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14 }}
                value={estimatedTimeSec}
                onChange={(e) => setEstimatedTimeSec(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Question</label>
            <textarea
              rows={3}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, resize: "vertical" }}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Mark scheme (one point per line)
            </label>
            <textarea
              rows={4}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, resize: "vertical" }}
              value={markScheme}
              onChange={(e) => setMarkScheme(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontSize: 14,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !topicKey || !question.trim() || !markScheme.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: 14,
              cursor: saving || !topicKey || !question.trim() || !markScheme.trim() ? "not-allowed" : "pointer",
              opacity: saving || !topicKey || !question.trim() || !markScheme.trim() ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Add question"}
          </button>
        </div>
      </div>
    </div>
  );
}
