/**
 * PR-005: Teacher-only "Ask AI about this topic" panel.
 * PR-006: Citation deep links, feedback (thumbs up/down).
 * PR-016a: Suggested learning actions (Next steps).
 */
import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  postEnquiry,
  postEnquiryFeedback,
  type PostEnquiryResponse,
  type UsedSource,
  type EnquiryCitation,
} from "../../api/enquiry";

type Props = {
  topicKey: string;
  specKey: string;
  lessonId?: string;
  defaultQuestion?: string;
};

export function AskAiPanel({ topicKey, specKey, lessonId, defaultQuestion = "" }: Props) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PostEnquiryResponse | null>(null);
  const [showAnswer, setShowAnswer] = useState<Record<number, boolean>>({});
  const [feedbackSent, setFeedbackSent] = useState<"up" | "down" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const practiceSectionRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setFeedbackSent(null);
    setFeedbackComment("");
    setShowCommentInput(false);
    try {
      const res = await postEnquiry({
        question: q,
        specKey,
        topicKey,
        mode: "lesson",
        limit: 8,
        includePractice: true,
      });
      setResponse(res);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e?.response?.data?.error || e?.message || "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  const togglePracticeAnswer = (idx: number) => {
    setShowAnswer((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const sourceMap = new Map<string, UsedSource>();
  response?.usedSources?.forEach((s) => sourceMap.set(s.knowledgeDocumentId, s));

  const buildCitationLink = (c: EnquiryCitation): string | null => {
    if (c.deepLink && c.deepLink.type === "lesson" && c.deepLink.lessonId) {
      const { lessonId, pageIndex, blockIndex } = c.deepLink;
      let url = `/lesson/${lessonId}`;
      const page = pageIndex ?? 0;
      url += `?page=${page}`;
      if (blockIndex != null) url += `#block-${blockIndex}`;
      return url;
    }
    if (c.sourceType === "lessonBlock" && c.sourceId) return `/lesson/${c.sourceId}`;
    return null;
  };

  const handleFeedback = async (rating: "up" | "down") => {
    const logId = response?.enquiryLogId;
    if (!logId || feedbackSent || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      await postEnquiryFeedback(logId, {
        rating,
        comment: rating === "down" && feedbackComment ? feedbackComment : undefined,
      });
      setFeedbackSent(rating);
      setShowCommentInput(false);
    } catch {
      // Silent fail for feedback
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: "1rem 1.25rem",
        borderRadius: 12,
        background: "#f0f9ff",
        border: "1px solid #bae6fd",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#0c4a6e", fontSize: "1.1rem" }}>
        Ask AI about this topic
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#0369a1" }}>
        Get answers from trusted LetsRevise curriculum sources. Citations included.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What do I need to know about…? / Explain ___ like I'm in Year 10"
          rows={2}
          disabled={loading}
          maxLength={500}
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            border: "1px solid #7dd3fc",
            borderRadius: 8,
            fontSize: 16,
            background: "#fff",
            resize: "vertical",
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          style={{
            padding: "0.5rem 1rem",
            background: loading ? "#94a3b8" : "#0284c7",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {loading ? "Searching trusted sources…" : "Ask AI"}
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 12, color: "#64748b", fontSize: 14 }}>
          Searching trusted sources…
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {response && !loading && (
        <div style={{ marginTop: 16 }}>
          {response.answer.warnings && response.answer.warnings.length > 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 8,
                background: "#fefce8",
                border: "1px solid #fde047",
                color: "#854d0e",
                fontSize: 14,
              }}
            >
              <strong>Note:</strong> {response.answer.warnings.join(" ")}
            </div>
          )}

          {/* PR-017: Confidence badge + reason (teacher/admin) */}
          {response.confidenceLevel && (
            <div
              style={{
                marginBottom: 12,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor:
                    response.confidenceLevel === "strong"
                      ? "#d1fae5"
                      : response.confidenceLevel === "moderate"
                        ? "#fef3c7"
                        : "#fee2e2",
                  color:
                    response.confidenceLevel === "strong"
                      ? "#065f46"
                      : response.confidenceLevel === "moderate"
                        ? "#92400e"
                        : "#991b1b",
                }}
              >
                Confidence: {response.confidenceLevel === "strong" ? "Strong" : response.confidenceLevel === "moderate" ? "Moderate" : "Weak"}
              </span>
              {response.confidenceReason && (
                <span style={{ fontSize: 13, color: "#64748b" }}>{response.confidenceReason}</span>
              )}
              {response.confidenceSignals && (
                <span
                  style={{ fontSize: 12, color: "#94a3b8" }}
                  title="Source breakdown"
                >
                  Sources: Spec {response.confidenceSignals.sources.spec}, Lesson {response.confidenceSignals.sources.lesson}
                </span>
              )}
            </div>
          )}

          <div style={{ marginBottom: 12, fontSize: 14, color: "#64748b" }}>
            Sources used: {response.usedSources?.length ?? 0}
            {response.cached && (
              <span style={{ marginLeft: 8, fontStyle: "italic" }}>(cached)</span>
            )}
          </div>

          {response.answer.explanation && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 15,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {response.answer.explanation}
            </div>
          )}

          {response.answer.keyPoints && response.answer.keyPoints.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#334155" }}>
                Key points
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
                {response.answer.keyPoints.map((kp, i) => (
                  <li key={i}>{kp}</li>
                ))}
              </ul>
            </div>
          )}

          {response.answer.citations && response.answer.citations.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#334155" }}>
                Citations
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {response.answer.citations.map((c, i) => {
                  const src = sourceMap.get(c.knowledgeDocumentId);
                  const linkTarget = buildCitationLink(c);
                  const hasLink = !!linkTarget;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 10,
                        background: "#fff",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        fontSize: 13,
                      }}
                    >
                      <div style={{ marginBottom: 4 }}>
                        <span
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: c.sourceType === "specStatement" ? "#dbeafe" : "#dcfce7",
                            color: c.sourceType === "specStatement" ? "#1e40af" : "#166534",
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          {c.sourceType === "specStatement" ? "Spec" : "Lesson"}
                        </span>
                        {src?.title && (
                          <span style={{ marginLeft: 8, color: "#475569" }}>{src.title}</span>
                        )}
                      </div>
                      <div style={{ color: "#64748b", fontStyle: "italic", marginBottom: 6 }}>
                        &ldquo;{c.quote}&rdquo;
                      </div>
                      {c.reason && (
                        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                          {c.reason}
                        </div>
                      )}
                      {hasLink && linkTarget && (
                        <Link
                          to={linkTarget}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: "#0284c7",
                            textDecoration: "none",
                            fontWeight: 600,
                          }}
                        >
                          Open source →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {response.answer.practice && response.answer.practice.length > 0 && (
            <div ref={practiceSectionRef}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#334155" }}>
                Practice
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {response.answer.practice.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      background: "#fff",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#f1f5f9",
                        color: "#475569",
                        fontWeight: 600,
                        fontSize: 11,
                        marginRight: 8,
                      }}
                    >
                      {p.type.toUpperCase()}
                    </span>
                    <div style={{ marginTop: 8, marginBottom: 8 }}>{p.question}</div>
                    {p.type === "mcq" && Array.isArray(p.options) && (
                      <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                        {p.options.map((opt, j) => (
                          <li key={j}>{opt}</li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => togglePracticeAnswer(i)}
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        background: "#e2e8f0",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: "#475569",
                      }}
                    >
                      {showAnswer[i] ? "Hide answer" : "Show answer"}
                    </button>
                    {showAnswer[i] && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: "#f0fdf4",
                          borderRadius: 6,
                          border: "1px solid #bbf7d0",
                          fontSize: 13,
                        }}
                      >
                        <strong>Answer:</strong> {p.answer}
                        {p.markScheme && (
                          <div style={{ marginTop: 4, fontSize: 12, color: "#166534" }}>
                            <strong>Mark scheme:</strong> {p.markScheme}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PR-016a: Next steps */}
          {response.suggestedActions && response.suggestedActions.length > 0 && (
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#334155" }}>
                Next steps
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {response.suggestedActions.map((action) => {
                  if (action.type === "intent" && action.payload?.action === "practice") {
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => practiceSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                        style={{
                          padding: "8px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          background: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #7dd3fc",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                      >
                        {action.label}
                      </button>
                    );
                  }
                  if (action.href) {
                    return (
                      <Link
                        key={action.id}
                        to={action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: "8px 14px",
                          fontSize: 13,
                          fontWeight: 600,
                          background: "#e0f2fe",
                          color: "#0369a1",
                          border: "1px solid #7dd3fc",
                          borderRadius: 8,
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        {action.label}
                      </Link>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}

          {/* PR-006: Feedback (thumbs up/down) */}
          {response.enquiryLogId && (
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>Was this helpful?</span>
              <button
                type="button"
                onClick={() => handleFeedback("up")}
                disabled={feedbackSent !== null || feedbackSubmitting}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
                  background: feedbackSent === "up" ? "#22c55e" : "#e2e8f0",
                  color: feedbackSent === "up" ? "#fff" : "#475569",
                  border: "none",
                  borderRadius: 8,
                  cursor: feedbackSent ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                👍 Helpful
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCommentInput(true);
                  handleFeedback("down");
                }}
                disabled={feedbackSent !== null || feedbackSubmitting}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
                  background: feedbackSent === "down" ? "#ef4444" : "#e2e8f0",
                  color: feedbackSent === "down" ? "#fff" : "#475569",
                  border: "none",
                  borderRadius: 8,
                  cursor: feedbackSent ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                👎 Not helpful
              </button>
              {showCommentInput && !feedbackSent && (
                <div style={{ flex: "1 1 100%", marginTop: 8 }}>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Optional: What could be better?"
                    rows={2}
                    style={{
                      width: "100%",
                      maxWidth: 400,
                      padding: 8,
                      fontSize: 13,
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleFeedback("down")}
                    disabled={feedbackSubmitting}
                    style={{
                      marginTop: 8,
                      padding: "6px 12px",
                      fontSize: 13,
                      background: "#64748b",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Submit
                  </button>
                </div>
              )}
            </div>
          )}

          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "#94a3b8",
            }}
          >
            Uses trusted LetsRevise sources only. If coverage is missing, it will say so.
          </p>
        </div>
      )}
    </div>
  );
}
