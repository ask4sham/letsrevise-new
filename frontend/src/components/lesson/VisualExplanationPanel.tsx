/**
 * P1 GCSE Visual Explanation panel — teacher/admin only, flag-gated.
 * Response-only v1: no save/attach.
 */
import React, { useState } from "react";
import { generateVisualExplanation, GenerateVisualExplanationResponse } from "../../api/visualExplanation";

const SECTIONS: Array<{ key: keyof GenerateVisualExplanationResponse["explanation"]; label: string }> = [
  { key: "what_image_shows", label: "What this image shows" },
  { key: "key_parts", label: "Key parts labelled" },
  { key: "step_by_step", label: "Step-by-step" },
  { key: "why_it_matters_gcse", label: "Why it matters for GCSE" },
  { key: "common_mistake", label: "Common mistake" },
  { key: "exam_tip", label: "Exam tip" },
  { key: "exam_question", label: "Exam-style question" },
  { key: "model_answer", label: "Model answer" },
];

export type VisualExplanationLessonProps = {
  id?: string;
  title?: string;
  topic?: string;
  subject?: string;
  level?: string;
  examBoardName?: string | null;
};

type Props = {
  lesson: VisualExplanationLessonProps;
};

function formatApiError(err: unknown): string {
  const e = err as {
    response?: { data?: { message?: string; detail?: string; error?: string } };
    message?: string;
  };
  const data = e?.response?.data;
  if (data?.message && typeof data.message === "string") return data.message;
  if (data?.detail && typeof data.detail === "string") return data.detail;
  if (data?.error && typeof data.error === "string") return data.error;
  return e?.message || "Failed to generate visual explanation.";
}

const VisualExplanationPanel: React.FC<Props> = ({ lesson }) => {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(lesson?.topic || lesson?.title || "");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateVisualExplanationResponse | null>(null);
  const [error, setError] = useState("");

  const subjectLabel = lesson?.subject
    ? `${lesson.level || "GCSE"} ${lesson.subject}`.trim()
    : "GCSE Biology";

  const onGenerate = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await generateVisualExplanation({
        topic: topic.trim(),
        context: context.trim() || null,
        subject: subjectLabel,
        exam_board: lesson?.examBoardName || "AQA",
        tier: lesson?.level === "Foundation" ? "Foundation" : "Higher",
        lesson_id: lesson?.id || null,
      });
      setResult(res);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      data-testid="visual-explanation-panel"
      style={{
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#fff",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="visual-explanation-toggle"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#111827" }}>
            Visual explanation
          </div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 2 }}>
            GCSE-style diagram + 8-section examiner explanation
          </div>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{open ? "Hide" : "Open"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid #e5e7eb" }}>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#9ca3af",
                  marginBottom: 4,
                }}
              >
                Topic to visualise
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                placeholder="e.g. The eye"
                data-testid="visual-explanation-topic-input"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  fontSize: "0.95rem",
                }}
              />
            </div>
            <button
              type="button"
              onClick={onGenerate}
              disabled={loading || !topic.trim()}
              data-testid="visual-explanation-generate-btn"
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: loading || !topic.trim() ? "#e5e7eb" : "#2563eb",
                color: loading || !topic.trim() ? "#9ca3af" : "#fff",
                fontWeight: 600,
                cursor: loading || !topic.trim() ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "Generating…" : "Generate visual"}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <label
              style={{
                display: "block",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "#9ca3af",
                marginBottom: 4,
              }}
            >
              Extra context (optional)
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              disabled={loading}
              placeholder="e.g. focus on accommodation for near objects"
              data-testid="visual-explanation-context-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: "0.95rem",
              }}
            />
          </div>

          {loading && (
            <div
              data-testid="visual-explanation-loading"
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 10,
                border: "1px dashed #d1d5db",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "0.9rem",
              }}
            >
              Drafting the GCSE explanation and the labelled diagram… this usually takes 30–60
              seconds.
            </div>
          )}

          {error && (
            <div
              data-testid="visual-explanation-error"
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div
              data-testid="visual-explanation-result"
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "minmax(0, 380px) minmax(0, 1fr)",
                gap: 16,
                alignItems: "start",
              }}
            >
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  overflow: "hidden",
                  background: "#f9fafb",
                }}
              >
                {result.image_data_url ? (
                  <img
                    src={result.image_data_url}
                    alt={result.explanation?.what_image_shows || "GCSE diagram"}
                    data-testid="visual-explanation-image"
                    style={{ width: "100%", height: "auto", display: "block", background: "#fff" }}
                  />
                ) : (
                  <div
                    data-testid="visual-explanation-image-placeholder"
                    style={{
                      aspectRatio: "4 / 3",
                      display: "grid",
                      placeItems: "center",
                      textAlign: "center",
                      padding: 20,
                      color: "#6b7280",
                      fontSize: "0.9rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        Image generation provider not connected
                      </div>
                      <div style={{ fontSize: "0.8rem" }}>
                        The GCSE explanation below was generated successfully. The diagram service
                        is temporarily unavailable — please try again in a moment.
                      </div>
                    </div>
                  </div>
                )}
                <div
                  style={{
                    padding: "8px 12px",
                    fontSize: "0.7rem",
                    color: "#9ca3af",
                    borderTop: "1px solid #e5e7eb",
                    background: "#fff",
                  }}
                >
                  {result.provider_status === "image_generated"
                    ? "© letsrevise.com · GCSE diagram"
                    : "© letsrevise.com · explanation only"}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                {SECTIONS.map(({ key, label }) => {
                  const v = result.explanation?.[key];
                  if (v == null || (Array.isArray(v) && v.length === 0)) return null;
                  return (
                    <div
                      key={key}
                      data-testid={`visual-explanation-section-${key}`}
                      style={{
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.7rem",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          color: "#9ca3af",
                          marginBottom: 6,
                        }}
                      >
                        {label}
                      </div>
                      {key === "key_parts" && Array.isArray(v) ? (
                        <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                          {(v as Array<{ label: string; what: string }>).map((p, i) => (
                            <li key={i} style={{ fontSize: "0.9rem", marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, color: "#2563eb" }}>{p.label}</span>
                              <span style={{ color: "#4b5563" }}> — {p.what}</span>
                            </li>
                          ))}
                        </ul>
                      ) : key === "step_by_step" && Array.isArray(v) ? (
                        <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.9rem" }}>
                          {(v as string[]).map((s, i) => (
                            <li key={i} style={{ marginBottom: 4 }}>
                              {s}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                          {String(v)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default VisualExplanationPanel;
