/**
 * Step 5 (LLM Roadmap): "Summarise" — get AI summary and key points for the lesson.
 */
import React, { useState } from "react";
import { summariseLesson } from "../../api/ai";

type Props = {
  lessonId: string;
  lessonTitle?: string;
  className?: string;
};

export function SummariseLesson({ lessonId, lessonTitle, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const handleSummarise = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setKeyPoints([]);
    setOpen(true);
    try {
      const res = await summariseLesson({ lessonId });
      setSummary(res.summary || null);
      setKeyPoints(Array.isArray(res.keyPoints) ? res.keyPoints : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || "Failed to summarise");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setSummary(null);
    setKeyPoints([]);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleSummarise}
        disabled={loading}
        className={className}
        style={{
          padding: "8px 14px",
          fontSize: 14,
          border: "1px solid #a78bfa",
          borderRadius: 8,
          background: "#f5f3ff",
          color: "#5b21b6",
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "…" : "Summarise this lesson"}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Lesson summary"
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
              maxWidth: 520,
              width: "90%",
              maxHeight: "85vh",
              overflow: "auto",
              padding: 20,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong style={{ color: "#5b21b6" }}>Summary & key points</strong>
              <button type="button" onClick={close} style={{ padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}>
                Close
              </button>
            </div>
            {loading && <p style={{ color: "#6b7280" }}>Generating summary…</p>}
            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
            {summary && !loading && (
              <>
                <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px 0", lineHeight: 1.6 }}>{summary}</p>
                {keyPoints.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 6, color: "#374151" }}>Key points</div>
                    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
                      {keyPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
