/**
 * PR-005: Teacher-only "Ask AI about this topic" panel.
 * PR-019: Threaded tutoring (API); UI shows only the latest Q&A for focus.
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  postEnquiry,
  postEnquiryFeedback,
  postEnquiryAction,
  type PostEnquiryResponse,
} from "../../api/enquiry";
import { createConversation, getConversation } from "../../api/conversations";
import { CitationsList } from "./CitationsList";
import { InlineDiagramBlock } from "./InlineDiagramBlock";
import { SuggestedActionsBar } from "./SuggestedActionsBar";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  enquiryLogId?: string | null;
  fullResponse?: PostEnquiryResponse | null;
  responseMode?: "quick" | "explain" | "exam" | "revision";
};

type Props = {
  topicKey: string;
  specKey: string;
  lessonId?: string;
  defaultQuestion?: string;
  /** When true, skip auto-scroll to messages end (e.g. preview entry, keeps lesson at top) */
  suppressAutoScroll?: boolean;
};

const SESSION_KEY_PREFIX = "askai:conv:";

/** PR-036: Teacher mode labels and tooltips */
const TEACHER_MODE_LABELS: Record<"quick" | "explain" | "exam" | "revision", string> = {
  quick: "Quick answer",
  explain: "Full explanation",
  exam: "Exam practice",
  revision: "Revision mode",
};
const TEACHER_MODE_TOOLTIPS: Record<"quick" | "explain" | "exam" | "revision", string> = {
  quick: "Short explanation + quick practice",
  explain: "Detailed explanation + examples",
  exam: "Exam-style question with mark scheme",
  revision: "Flashcards + memory cues",
};

function getSessionKey(specKey: string, topicKey: string, lessonId?: string): string {
  return `${SESSION_KEY_PREFIX}${specKey}:${topicKey}:${lessonId || ""}`;
}

/** Keep only the last user + assistant exchange (single-turn focused UI). */
function toLatestPair(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return [];
  const last = messages[messages.length - 1];
  if (last.role === "assistant") {
    const prev = messages[messages.length - 2];
    if (prev && prev.role === "user") return [prev, last];
    return [last];
  }
  return [last];
}

export function AskAiPanel({ topicKey, specKey, lessonId, defaultQuestion = "", suppressAutoScroll = false }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationInitFailed, setConversationInitFailed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState(defaultQuestion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({});
  const [feedbackSent, setFeedbackSent] = useState<Record<string, "up" | "down">>({});
  const [feedbackComment, setFeedbackComment] = useState<Record<string, string>>({});
  const [showCommentInput, setShowCommentInput] = useState<Record<string, boolean>>({});
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<Record<string, boolean>>({});
  const [practiceHighlightId, setPracticeHighlightId] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<"quick" | "explain" | "exam" | "revision">("explain");
  const [allowExternal, setAllowExternal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessionKey = getSessionKey(specKey, topicKey, lessonId);

  useEffect(() => {
    const stored = localStorage.getItem("askai:mode:teacher");
    if (stored && ["quick", "explain", "exam", "revision"].includes(stored)) {
      setResponseMode(stored as "quick" | "explain" | "exam" | "revision");
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("askai:allowExternal:teacher");
    setAllowExternal(stored === "true");
  }, []);

  const handleModeChange = (mode: "quick" | "explain" | "exam" | "revision") => {
    setResponseMode(mode);
    localStorage.setItem("askai:mode:teacher", mode);
  };

  const handleAllowExternalChange = (checked: boolean) => {
    setAllowExternal(checked);
    localStorage.setItem("askai:allowExternal:teacher", String(checked));
  };

  const loadConversation = useCallback((id: string) => {
    getConversation(id, { limit: 40 })
      .then((conv) => {
        const mapped = conv.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          text: m.text,
          createdAt: m.createdAt,
          enquiryLogId: m.enquiryLogId,
          fullResponse: null as PostEnquiryResponse | null,
        }));
        setMessages(toLatestPair(mapped));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(sessionKey);
    if (stored) {
      setConversationId(stored);
      loadConversation(stored);
    } else {
      createConversation({ specKey, topicKey, lessonId })
        .then(({ conversationId: id }) => {
          setConversationId(id);
          sessionStorage.setItem(sessionKey, id);
          setMessages([]);
        })
        .catch(() => setConversationInitFailed(true));
    }
  }, [specKey, topicKey, lessonId, sessionKey, loadConversation]);

  useEffect(() => {
    if (suppressAutoScroll) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[AskAiPanel] suppressed scroll (preview entry)", { messagesLength: messages.length });
      }
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[AskAiPanel] SCROLL_TRIGGER messages effect", { messagesLength: messages.length });
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, suppressAutoScroll]);

  const handleIntent = useCallback((payload: unknown, enquiryLogId?: string | null) => {
    const p = payload as { action?: string };
    if (p?.action === "practice" && enquiryLogId) {
      const el = document.getElementById(`practice-${enquiryLogId}`);
      el?.scrollIntoView({ behavior: "smooth" });
      setPracticeHighlightId(enquiryLogId);
      setTimeout(() => setPracticeHighlightId(null), 1000);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    const convId = conversationId;
    if (!convId && !conversationInitFailed) return;

    setLoading(true);
    setError(null);
    setQuestion("");

    setMessages([{ role: "user", text: q }]);

    try {
      const res = await postEnquiry({
        question: q,
        specKey,
        topicKey,
        conversationId: convId || undefined,
        mode: "lesson",
        limit: 8,
        includePractice: true,
        responseMode,
        allowExternal,
        lessonId: lessonId || undefined,
      });

      setMessages([
        { role: "user", text: q },
        {
          role: "assistant",
          text: res.answer.explanation || "",
          enquiryLogId: res.enquiryLogId || null,
          fullResponse: res,
          responseMode,
        },
      ]);
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        data?: { msg?: string; message?: string; error?: string; detail?: string };
      };
      // Axios interceptor puts the best human string on `message`; prefer that over raw `data.error` ("Unhandled server error")
      const fromInterceptor = typeof e?.message === "string" ? e.message : "";
      const apiMsg =
        (typeof e?.data?.msg === "string" && e.data.msg) ||
        (typeof e?.data?.message === "string" && e.data.message) ||
        (typeof e?.data?.detail === "string" && e.data.detail) ||
        "";
      const genericErr =
        typeof e?.data?.error === "string" &&
        (e.data.error === "Unhandled server error" || e.data.error === "Request failed" || e.data.error === "Server error")
          ? ""
          : typeof e?.data?.error === "string"
            ? e.data.error
            : "";
      setError(fromInterceptor || apiMsg || genericErr || "Failed to get answer");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePracticeAnswer = (enquiryLogId: string, idx: number) => {
    const key = `${enquiryLogId}-${idx}`;
    setShowAnswer((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFeedback = async (logId: string, rating: "up" | "down") => {
    if (feedbackSent[logId] || feedbackSubmitting[logId]) return;
    setFeedbackSubmitting((prev) => ({ ...prev, [logId]: true }));
    try {
      await postEnquiryFeedback(logId, {
        rating,
        comment: rating === "down" && feedbackComment[logId] ? feedbackComment[logId] : undefined,
      });
      setFeedbackSent((prev) => ({ ...prev, [logId]: rating }));
      setShowCommentInput((prev) => ({ ...prev, [logId]: false }));
    } catch {
      // Silent fail
    } finally {
      setFeedbackSubmitting((prev) => ({ ...prev, [logId]: false }));
    }
  };

  const canSend = conversationId || conversationInitFailed;

  const latestSlice = toLatestPair(messages);
  const latestUser = latestSlice[0]?.role === "user" ? latestSlice[0] : null;
  const latestAssistant =
    latestSlice.length >= 2 && latestSlice[1].role === "assistant"
      ? latestSlice[1]
      : latestSlice.length === 1 && latestSlice[0].role === "assistant"
        ? latestSlice[0]
        : null;

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
        Ask Sham
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#0369a1" }}>
        Get answers from trusted LetsRevise curriculum sources. Only your latest question and answer are shown here.
      </p>

      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>Mode:</span>
        {(["quick", "explain", "exam", "revision"] as const).map((m) => (
          <button
            key={m}
            type="button"
            title={TEACHER_MODE_TOOLTIPS[m]}
            onClick={() => handleModeChange(m)}
            style={{
              marginRight: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              background: responseMode === m ? "#0284c7" : "#e0f2fe",
              color: responseMode === m ? "#fff" : "#0369a1",
              border: "1px solid #7dd3fc",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {TEACHER_MODE_LABELS[m]}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={allowExternal}
            onChange={(e) => handleAllowExternalChange(e.target.checked)}
          />
          <span>Use external references when course content is thin</span>
        </label>
      </div>

      <div style={{ maxHeight: 420, overflowY: "auto", marginBottom: 12 }}>
        {(latestUser || latestAssistant) && (
          <div style={{ marginBottom: 12 }}>
            {latestUser && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                    marginBottom: 4,
                  }}
                >
                  Your question:
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#334155",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {latestUser.text}
                </div>
              </div>
            )}
            {latestAssistant && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "#fff",
                  color: "#334155",
                  border: "1px solid #e2e8f0",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {latestAssistant.fullResponse ? (
                  <AssistantBubbleTeacher
                    response={latestAssistant.fullResponse}
                    enquiryLogId={latestAssistant.enquiryLogId}
                    specKey={specKey}
                    topicKey={topicKey}
                    practiceHighlightId={practiceHighlightId}
                    showAnswer={showAnswer}
                    feedbackSent={feedbackSent}
                    feedbackComment={feedbackComment}
                    showCommentInput={showCommentInput}
                    feedbackSubmitting={feedbackSubmitting}
                    onTogglePractice={togglePracticeAnswer}
                    onFeedback={handleFeedback}
                    onSetCommentInput={(id, v) =>
                      setShowCommentInput((prev) => ({ ...prev, [id]: v }))
                    }
                    onCommentChange={(id, v) =>
                      setFeedbackComment((prev) => ({ ...prev, [id]: v }))
                    }
                    onIntent={(p) => handleIntent(p, latestAssistant.enquiryLogId)}
                  />
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{latestAssistant.text}</div>
                )}
              </div>
            )}
          </div>
        )}
        {loading && (
          <div style={{ marginBottom: 12, fontSize: 14, color: "#64748b" }}>
            Searching trusted sources…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
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

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What do I need to know about…? / Explain simpler / Give me another example"
          rows={2}
          disabled={loading || !canSend}
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
          disabled={loading || !question.trim() || !canSend}
          style={{
            padding: "0.5rem 1rem",
            background: loading || !canSend ? "#94a3b8" : "#0284c7",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: loading || !canSend ? "not-allowed" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {loading ? "Searching…" : "Send"}
        </button>
      </form>

      <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
        Uses trusted LetsRevise sources only. If coverage is missing, it will say so.
      </p>
    </div>
  );
}

type AssistantBubbleTeacherProps = {
  response: PostEnquiryResponse;
  enquiryLogId?: string | null;
  specKey?: string;
  topicKey?: string;
  practiceHighlightId: string | null;
  showAnswer: Record<string, boolean>;
  feedbackSent: Record<string, "up" | "down">;
  feedbackComment: Record<string, string>;
  showCommentInput: Record<string, boolean>;
  feedbackSubmitting: Record<string, boolean>;
  onTogglePractice: (enquiryLogId: string, idx: number) => void;
  onFeedback: (logId: string, rating: "up" | "down") => void;
  onSetCommentInput: (id: string, v: boolean) => void;
  onCommentChange: (id: string, v: string) => void;
  onIntent: (payload: unknown) => void;
};

function AssistantBubbleTeacher({
  response,
  enquiryLogId,
  specKey,
  topicKey,
  practiceHighlightId,
  showAnswer,
  feedbackSent,
  feedbackComment,
  showCommentInput,
  feedbackSubmitting,
  onTogglePractice,
  onFeedback,
  onSetCommentInput,
  onCommentChange,
  onIntent,
}: AssistantBubbleTeacherProps) {
  const logId = response.enquiryLogId || "";
  const sent = feedbackSent[logId];
  const comment = feedbackComment[logId] || "";
  const showComment = showCommentInput[logId];
  const submitting = feedbackSubmitting[logId];

  const fallbackNotice = (response.fallbackNotice || "").trim();
  const noteWarnings = (response.answer.warnings || []).filter(
    (w) => !fallbackNotice || w.trim() !== fallbackNotice
  );

  return (
    <div style={{ width: "100%", textAlign: "left" }}>
      {response.source === "fallback_ai" && fallbackNotice && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 8,
            background: "#fce7f3",
            border: "1px solid #f9a8d4",
            color: "#831843",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong>General knowledge:</strong> {fallbackNotice}
        </div>
      )}
      {noteWarnings.length > 0 && (
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
              <strong>Note:</strong> {noteWarnings.join(" ")}
            </div>
          )}

      {response.answer.explanation && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#f8fafc",
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

      {response.answer.memoryHook?.trim() && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            background: "#f8fafc",
            borderLeft: "3px solid #94a3b8",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 6,
            }}
          >
            Memory hook
          </div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.45, fontWeight: 500 }}>
            {response.answer.memoryHook.trim()}
          </div>
        </div>
      )}

      {/* PR-034: Inline diagram rendering — after explanation/keyPoints, before citations */}
      {response.answer.citations && (
        <InlineDiagramBlock citations={response.answer.citations} studentMode={false} />
      )}

      {response.answer.citations && response.answer.citations.length > 0 && (
        <CitationsList
          citations={response.answer.citations}
          usedSources={response.usedSources}
          defaultQuotesExpanded={true}
          studentMode={false}
          linkText="Open source"
          specKey={specKey}
          topicKey={topicKey}
        />
      )}

      {response.answer.practice && response.answer.practice.length > 0 && enquiryLogId && (
        <div
          id={`practice-${enquiryLogId}`}
          style={{
            marginTop: 16,
            transition: "box-shadow 0.3s ease",
            boxShadow: practiceHighlightId === enquiryLogId ? "0 0 0 3px #7dd3fc" : "none",
            borderRadius: 8,
          }}
        >
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#334155" }}>
            Practice
              </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {response.answer.practice.map((p, i) =>
              p.type === "flashcard" ? (
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
                      background: "#fef3c7",
                      color: "#92400e",
                            fontWeight: 600,
                            fontSize: 11,
                      marginRight: 8,
                          }}
                        >
                    FLASHCARD
                        </span>
                  <div style={{ marginTop: 8, marginBottom: 8, fontWeight: 600 }}>
                    {p.front}
                      </div>
                  <button
                    type="button"
                    onClick={() => onTogglePractice(enquiryLogId, i)}
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
                    {showAnswer[`${enquiryLogId}-${i}`] ? "Hide back" : "Show back"}
                  </button>
                  {showAnswer[`${enquiryLogId}-${i}`] && p.back && (
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
                      {p.back}
            </div>
          )}
              </div>
              ) : (
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
                    onClick={() => onTogglePractice(enquiryLogId, i)}
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
                    {showAnswer[`${enquiryLogId}-${i}`] ? "Hide answer" : "Show answer"}
                    </button>
                  {showAnswer[`${enquiryLogId}-${i}`] && (
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
              )
            )}
              </div>
            </div>
          )}

      {response.suggestedActions && response.suggestedActions.length > 0 && (
        <SuggestedActionsBar
          actions={response.suggestedActions}
          mode="teacher"
          onIntent={onIntent}
          onActionClick={
            enquiryLogId
              ? (actionId) => postEnquiryAction(enquiryLogId, actionId).catch(() => {})
              : undefined
          }
        />
      )}

      {enquiryLogId && (
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
              <span style={{ fontSize: 13, color: "#64748b" }}>Was this helpful?</span>
              <button
                type="button"
            onClick={() => onFeedback(logId, "up")}
            disabled={sent !== undefined || submitting}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
              background: sent === "up" ? "#22c55e" : "#e2e8f0",
              color: sent === "up" ? "#fff" : "#475569",
                  border: "none",
                  borderRadius: 8,
              cursor: sent ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                👍 Helpful
              </button>
              <button
                type="button"
            onClick={() => onSetCommentInput(logId, true)}
            disabled={sent !== undefined || submitting}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
              background: sent === "down" ? "#ef4444" : "#e2e8f0",
              color: sent === "down" ? "#fff" : "#475569",
                  border: "none",
                  borderRadius: 8,
              cursor: sent ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                👎 Not helpful
              </button>
          {showComment && !sent && (
                <div style={{ flex: "1 1 100%", marginTop: 8 }}>
                  <textarea
                value={comment}
                onChange={(e) => onCommentChange(logId, e.target.value)}
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
                onClick={() => onFeedback(logId, "down")}
                disabled={submitting}
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
    </div>
  );
}
