/**
 * Step 1 (LLM Roadmap): "Explain this" button — fetches plain-text explanation for a content chunk.
 * Use next to a paragraph/block in lesson view; pass the block's text.
 */
import React, { useState } from "react";
import { explainChunk } from "../../api/ai";

type Props = {
  text: string;
  level?: string;
  subject?: string;
  label?: string;
  className?: string;
};

export function ExplainThisButton({ text, level, subject, label = "Explain this", className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const trimmed = (text || "").trim();
  const disabled = !trimmed || loading;

  const handleClick = async () => {
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setExplanation(null);
    setOpen(true);
    try {
      const res = await explainChunk({ text: trimmed, level, subject });
      setExplanation(res.explanation || "No explanation returned.");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || "Failed to get explanation");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setExplanation(null);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={className}
        style={{
          padding: "4px 8px",
          fontSize: 12,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          background: "#f9fafb",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "…" : label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Explanation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={close}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              maxWidth: 480,
              width: "90%",
              maxHeight: "80vh",
              overflow: "auto",
              padding: 20,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong>Explanation</strong>
              <button type="button" onClick={close} style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6 }}>
                Close
              </button>
            </div>
            {loading && <p style={{ color: "#6b7280" }}>Loading…</p>}
            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
            {explanation && !loading && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{explanation}</p>}
          </div>
        </div>
      )}
    </>
  );
}
