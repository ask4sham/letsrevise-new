/**
 * Step 2 (LLM Roadmap): "Explain my mistake" — fetches misconception/correct-concept explanation for a wrong answer.
 * Use on wrong-answer review (e.g. assessment results, quiz feedback).
 */
import React, { useState } from "react";
import { explainMistake, type ExplainMistakeParams } from "../../api/ai";

type Props = ExplainMistakeParams & {
  label?: string;
  className?: string;
};

export function ExplainMyMistakeButton({
  questionText,
  userAnswer,
  correctAnswer,
  topic,
  markScheme,
  level,
  subject,
  label = "Explain my mistake",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const trimmedQ = (questionText || "").trim();
  const trimmedCorrect = (correctAnswer || "").trim();
  const disabled = !trimmedQ || !trimmedCorrect || loading;

  const handleClick = async () => {
    if (disabled) return;
    setLoading(true);
    setError(null);
    setExplanation(null);
    setOpen(true);
    try {
      const res = await explainMistake({
        questionText: trimmedQ,
        userAnswer: (userAnswer ?? "").trim(),
        correctAnswer: trimmedCorrect,
        topic,
        markScheme,
        level,
        subject,
      });
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
          background: "#fef3c7",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "…" : label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Explain my mistake"
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
              <strong>Explain my mistake</strong>
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
