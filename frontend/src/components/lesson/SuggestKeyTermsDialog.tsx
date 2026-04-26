import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { suggestKeyTermsForBlock, type SuggestedKeyTermRow } from "../../api/ai";

export type SuggestKeyTermsDialogProps = {
  open: boolean;
  onClose: () => void;
  lessonTitle: string;
  subject: string;
  level: string;
  examBoardName: string | null;
  topic: string;
  pageTitle: string;
  /** Latest block body (e.g. textarea value) when generating / applying */
  getBlockText: () => string;
  /** Selected rows with possibly edited definitions — never called without teacher confirmation */
  onAddSelected: (items: SuggestedKeyTermRow[]) => void;
};

type Row = SuggestedKeyTermRow & { id: string; selected: boolean };

function newId() {
  return `skt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * AI-suggested glossary terms for the current block; teacher selects rows then adds — no auto-insert.
 */
export function SuggestKeyTermsDialog({
  open,
  onClose,
  lessonTitle,
  subject,
  level,
  examBoardName,
  topic,
  pageTitle,
  getBlockText,
  onAddSelected,
}: SuggestKeyTermsDialogProps): React.ReactElement | null {
  const [rows, setRows] = useState<Row[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows([]);
    setError(null);
    setInfo(null);
    setAiLoading(false);
  }, [open]);

  const canGenerate = useMemo(() => !aiLoading, [aiLoading]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setError(null);
    setInfo(null);
    const blockText = getBlockText();
    if (!String(blockText || "").trim()) {
      setError("Add some text to this block first.");
      return;
    }
    setAiLoading(true);
    try {
      const { items, _disabled } = await suggestKeyTermsForBlock({
        lessonTitle,
        subject,
        level,
        examBoardName,
        topic,
        pageTitle,
        blockText,
      });
      if (_disabled) {
        setError("Suggestions are not available. Please try again later.");
        setRows([]);
        return;
      }
      setRows(
        items.map((r) => ({
          ...r,
          id: newId(),
          selected: false,
        }))
      );
    } catch (e) {
      if (e && typeof e === "object" && (e as Error).message === "empty_block") {
        setError("Add some text to this block first.");
      } else {
        setError("Could not generate suggestions. Please try again.");
      }
      setRows([]);
    } finally {
      setAiLoading(false);
    }
  }, [
    canGenerate,
    examBoardName,
    getBlockText,
    lessonTitle,
    level,
    pageTitle,
    subject,
    topic,
  ]);

  const updateDefinition = (id: string, definition: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, definition } : r)));
  };

  const toggle = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));
  };

  const handleAdd = () => {
    const selected = rows.filter((r) => r.selected && r.term.trim());
    if (!selected.length) {
      setInfo("Select at least one term, or choose Cancel.");
      return;
    }
    onAddSelected(
      selected.map((r) => ({
        term: r.term.trim(),
        definition: r.definition.trim(),
      }))
    );
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggest-key-terms-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10050,
        padding: 16,
        boxSizing: "border-box",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflow: "auto",
          background: "white",
          borderRadius: 12,
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          padding: "20px 22px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="suggest-key-terms-title"
          style={{ margin: "0 0 14px", fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}
        >
          Suggest key terms
        </h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px", lineHeight: 1.45 }}>
          Suggestions are for the <strong>current block</strong> only. Select terms to add to the page glossary
          and mark the first unmarked match in the block text.
        </p>
        {error ? (
          <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginBottom: 12, lineHeight: 1.45 }}>
            {error}
          </div>
        ) : null}
        {info ? (
          <div style={{ fontSize: 13, color: "#b45309", marginBottom: 12, lineHeight: 1.45 }}>{info}</div>
        ) : null}

        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "2px solid rgba(59,130,246,0.45)",
              background: canGenerate ? "rgba(59,130,246,0.08)" : "rgba(148,163,184,0.2)",
              color: canGenerate ? "#1d4ed8" : "#94a3b8",
              fontWeight: 700,
              fontSize: 13,
              cursor: canGenerate ? "pointer" : "not-allowed",
            }}
          >
            {aiLoading ? "Generating…" : "Generate suggestions with AI"}
          </button>
        </div>

        {rows.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {rows.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr",
                  gap: 8,
                  alignItems: "start",
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={() => toggle(r.id)}
                  aria-label={`Select ${r.term}`}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14, marginBottom: 4 }}>{r.term}</div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b" }}>Definition</label>
                  <textarea
                    value={r.definition}
                    onChange={(e) => updateDefinition(r.id, e.target.value)}
                    rows={2}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      marginTop: 4,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.16)",
                      fontSize: 13,
                      lineHeight: 1.45,
                      resize: "vertical",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : !aiLoading && !error ? (
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 0" }}>
            No suggestions yet. Run “Generate suggestions with AI”.
          </p>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              color: "#475569",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={rows.length === 0}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "2px solid rgba(34,197,94,0.5)",
              background: rows.length > 0 ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.2)",
              fontWeight: 800,
              fontSize: 14,
              cursor: rows.length > 0 ? "pointer" : "not-allowed",
              color: rows.length > 0 ? "#15803d" : "#94a3b8",
            }}
          >
            Add selected key terms
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
