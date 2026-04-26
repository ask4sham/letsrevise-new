import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { suggestKeyTermDefinition } from "../../api/ai";

export type AddKeyTermDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Bumps when opening again so the same key can re-open with new selection */
  initialTerm: string;
  blockContext: string;
  pageTitle: string;
  lessonTitle: string;
  subject: string;
  level: string;
  examBoardName: string | null;
  topic: string;
  /** Adds / updates the term in local lesson state only — not an API save. */
  onAdd: (term: string, definition: string) => void;
};

/**
 * Teacher flow: set term (often from block selection), optional AI definition, review, then add to glossary.
 */
export function AddKeyTermDialog({
  open,
  onClose,
  initialTerm,
  blockContext,
  pageTitle,
  lessonTitle,
  subject,
  level,
  examBoardName,
  topic,
  onAdd,
}: AddKeyTermDialogProps): React.ReactElement | null {
  const [term, setTerm] = useState(initialTerm);
  const [definition, setDefinition] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTerm(initialTerm);
    setDefinition("");
    setAiError(null);
    setAiLoading(false);
  }, [open, initialTerm]);

  if (!open) return null;

  const canGenerate = term.trim().length > 0 && !aiLoading;
  const canAdd = term.trim().length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await suggestKeyTermDefinition({
        term: term.trim(),
        lessonTitle,
        subject,
        level,
        examBoardName,
        topic,
        pageTitle,
        blockContext: blockContext || "(no block text)",
      });
      if (res._disabled) {
        setAiError("Could not generate. Please type manually.");
        return;
      }
      setDefinition(res.definition || "");
    } catch {
      setAiError("Could not generate. Please type manually.");
    } finally {
      setAiLoading(false);
    }
  };

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-key-term-title"
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
          maxWidth: 480,
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
          id="add-key-term-title"
          style={{ margin: "0 0 14px", fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}
        >
          Add key term
        </h2>

        <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
          Term
        </label>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoComplete="off"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            borderRadius: 10,
            border: "2px solid rgba(15,23,42,0.14)",
            fontSize: 15,
            marginBottom: 14,
          }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
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
            {aiLoading ? "Generating…" : "Generate explanation with AI"}
          </button>
        </div>

        {aiError ? (
          <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginBottom: 10, lineHeight: 1.45 }}>
            {aiError}
          </div>
        ) : null}

        <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 6 }}>
          Definition
        </label>
        <textarea
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          rows={4}
          placeholder="Type a short student-friendly definition, or use AI to suggest one."
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "10px 12px",
            borderRadius: 10,
            border: "2px solid rgba(15,23,42,0.14)",
            fontSize: 14,
            lineHeight: 1.5,
            resize: "vertical",
            minHeight: 100,
            fontFamily: "system-ui, sans-serif",
          }}
        />
        <p style={{ fontSize: 12, color: "#64748b", margin: "10px 0 0", lineHeight: 1.45 }}>
          AI only fills the box for you to review. Nothing is saved until you use Save on the lesson.
        </p>

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
            disabled={!canAdd}
            onClick={() => {
              onAdd(term.trim(), definition.trim());
              onClose();
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "2px solid rgba(34,197,94,0.5)",
              background: canAdd ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.2)",
              fontWeight: 800,
              fontSize: 14,
              cursor: canAdd ? "pointer" : "not-allowed",
              color: canAdd ? "#15803d" : "#94a3b8",
            }}
          >
            Add to glossary
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
