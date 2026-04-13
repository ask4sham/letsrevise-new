/**
 * PR-007: Student "Ask for help" panel — simplified UX, practice-first.
 * PR-019: Threaded tutoring (API); UI shows only the latest Q&A for focus.
 * PR-033: Tutor action chips (Explain again, Explain simpler, Another example, Practice question, Show diagram).
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  postEnquiry,
  postEnquiryAction,
  type PostEnquiryResponse,
} from "../../api/enquiry";
import { createConversation, getConversation } from "../../api/conversations";
import { Link } from "react-router-dom";
import { CitationsList } from "./CitationsList";
import { InlineDiagramBlock } from "./InlineDiagramBlock";
import { SuggestedActionsBar } from "./SuggestedActionsBar";

/** Learning reinforcement (not grading) — full string sent as the next enquiry in-thread. */
const LEARNING_FOLLOW_UPS: { label: string; prompt: string }[] = [
  { label: "Explain this in simpler terms", prompt: "Explain this in simpler terms" },
  { label: "Give me another example", prompt: "Give me another example" },
  { label: "What do I need to remember for the exam?", prompt: "What do I need to remember for the exam?" },
  { label: "Test me on this topic", prompt: "Test me on this topic" },
];

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  enquiryLogId?: string | null;
  fullResponse?: PostEnquiryResponse | null;
  responseMode?: "quick" | "explain" | "revision";
};

type Props = {
  topicKey: string;
  specKey: string;
  lessonId?: string;
  /** When true, skip auto-scroll to messages end (e.g. preview entry, keeps lesson at top) */
  suppressAutoScroll?: boolean;
};

const SESSION_KEY_PREFIX = "askai:conv:student:";

/** PR-036: Student mode labels and tooltips */
const STUDENT_MODE_LABELS: Record<"quick" | "explain" | "revision", string> = {
  quick: "Quick help",
  explain: "Explain",
  revision: "Revision",
};
const STUDENT_MODE_TOOLTIPS: Record<"quick" | "explain" | "revision", string> = {
  quick: "Short explanation + quick practice",
  explain: "Detailed explanation + examples",
  revision: "Flashcards + memory cues",
};

function tutorChipStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 20,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#e2e8f0" : "#dcfce7",
    color: disabled ? "#94a3b8" : "#166534",
    border: `1px solid ${disabled ? "#cbd5e1" : "#86efac"}`,
    display: "inline-flex",
    alignItems: "center",
  };
}

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

export function AskAiStudentPanel({ topicKey, specKey, lessonId, suppressAutoScroll = false }: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationInitFailed, setConversationInitFailed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});
  const [practiceHighlightId, setPracticeHighlightId] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<"quick" | "explain" | "revision">("explain");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessionKey = getSessionKey(specKey, topicKey, lessonId);

  useEffect(() => {
    const stored = localStorage.getItem("askai:mode:student");
    if (stored && ["quick", "explain", "revision"].includes(stored)) {
      setResponseMode(stored as "quick" | "explain" | "revision");
    }
  }, []);

  const handleModeChange = (mode: "quick" | "explain" | "revision") => {
    setResponseMode(mode);
    localStorage.setItem("askai:mode:student", mode);
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
        console.log("[AskAiStudentPanel] suppressed scroll (preview entry)", { messagesLength: messages.length });
      }
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[AskAiStudentPanel] SCROLL_TRIGGER messages effect", { messagesLength: messages.length });
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

  /** PR-033: Shared send for typed input and tutor chips. Does not clear input when sending chip prompts. */
  const sendStudentMessage = useCallback(
    async ({ message, modeOverride }: { message: string; modeOverride?: "quick" | "explain" | "revision" }) => {
      const q = message.trim();
    if (!q || loading) return;

      const convId = conversationId;
      if (!convId && !conversationInitFailed) return;

    setLoading(true);
    setError(null);
      // Only clear input when sending user's typed text (form submit), not tutor chip messages
      if (q === question.trim()) setQuestion("");

      setMessages([{ role: "user", text: q }]);

    try {
      const res = await postEnquiry({
        question: q,
        specKey,
        topicKey,
          conversationId: convId || undefined,
        mode: "lesson",
        limit: 6,
        includePractice: true,
          responseMode: modeOverride ?? responseMode,
        lessonId: lessonId || undefined,
        });

        setMessages([
          { role: "user", text: q },
          {
            role: "assistant",
            text: res.answer.explanation || "",
            enquiryLogId: res.enquiryLogId || null,
            fullResponse: res,
          },
        ]);
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        data?: { msg?: string; message?: string; error?: string; detail?: string };
      };
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
    },
    [conversationId, conversationInitFailed, loading, question, specKey, topicKey, responseMode, lessonId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendStudentMessage({ message: question.trim() });
  };

  const sendTutorPrompt = (message: string, mode: "quick" | "explain" | "revision") => {
    handleModeChange(mode);
    sendStudentMessage({ message, modeOverride: mode });
  };

  const togglePracticeAnswer = (enquiryLogId: string, idx: number) => {
    const key = `${enquiryLogId}-${idx}`;
    setShowAnswer((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExplanation = (enquiryLogId: string) => {
    setShowExplanation((prev) => ({ ...prev, [enquiryLogId]: !prev[enquiryLogId] }));
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
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#166534", fontSize: "1.1rem" }}>
        Ask for help on this topic
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#15803d" }}>
        Ask a question about this lesson… Tutor actions and follow-ups still use the same thread; only your latest
        exchange is shown here.
      </p>

      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>Mode:</span>
        {(["quick", "explain", "revision"] as const).map((m) => (
          <button
            key={m}
            type="button"
            title={STUDENT_MODE_TOOLTIPS[m]}
            onClick={() => handleModeChange(m)}
            style={{
              marginRight: 6,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
              background: responseMode === m ? "#16a34a" : "#dcfce7",
              color: responseMode === m ? "#fff" : "#166534",
              border: "1px solid #86efac",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {STUDENT_MODE_LABELS[m]}
          </button>
        ))}
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
                  border: "1px solid #bbf7d0",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {latestAssistant.fullResponse ? (
                  <AssistantBubbleStudent
                    response={latestAssistant.fullResponse}
                    lessonId={lessonId}
                    enquiryLogId={latestAssistant.enquiryLogId}
                    practiceHighlightId={practiceHighlightId}
                    showAnswer={showAnswer}
                    showExplanation={showExplanation[latestAssistant.enquiryLogId || ""]}
                    onTogglePractice={togglePracticeAnswer}
                    onToggleExplanation={() =>
                      latestAssistant.enquiryLogId && toggleExplanation(latestAssistant.enquiryLogId)
                    }
                    onIntent={(p) => handleIntent(p, latestAssistant.enquiryLogId)}
                    onFollowUpPrompt={(prompt) => sendStudentMessage({ message: prompt })}
                    followUpsDisabled={loading}
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

      {/* PR-033: Tutor action chips — one-tap follow-ups */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 6,
          }}
        >
          Tutor actions
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => sendTutorPrompt("Can you explain that again in different words?", "explain")}
            disabled={loading || !canSend}
            style={tutorChipStyle(loading || !canSend)}
          >
            Explain again
          </button>
          <button
            type="button"
            onClick={() => sendTutorPrompt("Explain it more simply, like I'm in Year 9.", "quick")}
            disabled={loading || !canSend}
            style={tutorChipStyle(loading || !canSend)}
          >
            Explain simpler
          </button>
          <button
            type="button"
            onClick={() =>
              sendTutorPrompt("Give a different example and explain it step by step.", "explain")
            }
            disabled={loading || !canSend}
            style={tutorChipStyle(loading || !canSend)}
          >
            Another example
          </button>
          <button
            type="button"
            onClick={() =>
              sendTutorPrompt("Give me 1 practice question on this, then explain the answer.", "quick")
            }
            disabled={loading || !canSend}
            style={tutorChipStyle(loading || !canSend)}
          >
            Practice question
          </button>
          {lessonId && (
            <button
              type="button"
              onClick={() =>
                sendTutorPrompt(
                  "If there is a diagram in this lesson, show it and explain what it shows.",
                  "explain"
                )
              }
              disabled={loading || !canSend}
              style={tutorChipStyle(loading || !canSend)}
            >
              Show diagram
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What do I need to know about…? / Explain simpler"
          rows={2}
          disabled={loading || !canSend}
          maxLength={500}
          style={{
            width: "100%",
            padding: "0.5rem 0.75rem",
            border: "1px solid #86efac",
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
            background: loading || !canSend ? "#94a3b8" : "#16a34a",
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
        Answers are based on your LetsRevise lessons and course spec.
      </p>
    </div>
  );
}

type AssistantBubbleStudentProps = {
  response: PostEnquiryResponse;
  lessonId?: string;
  enquiryLogId?: string | null;
  practiceHighlightId: string | null;
  showAnswer: Record<string, boolean>;
  showExplanation: boolean;
  onTogglePractice: (enquiryLogId: string, idx: number) => void;
  onToggleExplanation: () => void;
  onIntent: (payload: unknown) => void;
  /** Sends a new enquiry with the given prompt (same conversation). */
  onFollowUpPrompt?: (prompt: string) => void;
  followUpsDisabled?: boolean;
};

function AssistantBubbleStudent({
  response,
  lessonId,
  enquiryLogId,
  practiceHighlightId,
  showAnswer,
  showExplanation,
  onTogglePractice,
  onToggleExplanation,
  onIntent,
  onFollowUpPrompt,
  followUpsDisabled = false,
}: AssistantBubbleStudentProps) {
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

          {/* PR-007: Practice first */}
      {response.answer.practice && response.answer.practice.length > 0 && enquiryLogId && (
        <div
          id={`practice-${enquiryLogId}`}
          style={{
            marginBottom: 16,
            transition: "box-shadow 0.3s ease",
            boxShadow: practiceHighlightId === enquiryLogId ? "0 0 0 3px #86efac" : "none",
            borderRadius: 8,
          }}
        >
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#166534" }}>
                Try these practice questions
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
                    border: "1px solid #bbf7d0",
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
                      background: "#dcfce7",
                      border: "1px solid #86efac",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "#166534",
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
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#dcfce7",
                        color: "#166534",
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
                        background: "#dcfce7",
                        border: "1px solid #86efac",
                        borderRadius: 6,
                        cursor: "pointer",
                        color: "#166534",
                      }}
                    >
                    {showAnswer[`${enquiryLogId}-${i}`] ? "Hide answer" : "Reveal answer"}
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

          {/* Explanation — collapsed by default */}
          {response.answer.explanation && (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
            onClick={onToggleExplanation}
                style={{
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: showExplanation ? "#e2e8f0" : "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  cursor: "pointer",
                  color: "#334155",
                }}
              >
                {showExplanation ? "Hide explanation" : "Show explanation"}
              </button>
              {showExplanation && (
                <div
                  style={{
                    marginTop: 8,
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
            </div>
          )}

      {response.answer.memoryHook?.trim() && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            background: "#f0fdf4",
            borderLeft: "3px solid #22c55e",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#15803d",
              marginBottom: 6,
            }}
          >
            Memory hook
          </div>
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.45, fontWeight: 500 }}>
            {response.answer.memoryHook.trim()}
          </div>
        </div>
      )}

      {/* PR-034: Inline diagram rendering — after explanation, before citations */}
      {response.answer.citations && (
        <InlineDiagramBlock citations={response.answer.citations} studentMode={true} />
      )}

      {/* PR-037: Study Coach — coverage-aware learning suggestions */}
      {response.learningSuggestions && response.learningSuggestions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: "#166534" }}>
            Study coach
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {response.learningSuggestions.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #bbf7d0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#334155" }}>
                    {s.topicKey.split(":").pop()?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || s.topicKey}
                  </span>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                      fontSize: 11,
                              fontWeight: 600,
                      background:
                        s.status === "THIN"
                          ? "#fef3c7"
                          : s.status === "NO_SPEC" || s.status === "EMPTY"
                            ? "#fee2e2"
                            : "#dcfce7",
                      color:
                        s.status === "THIN"
                          ? "#92400e"
                          : s.status === "NO_SPEC" || s.status === "EMPTY"
                            ? "#991b1b"
                            : "#166534",
                    }}
                  >
                    {s.status === "NO_SPEC" || s.status === "EMPTY"
                      ? "Missing"
                      : s.status === "THIN"
                        ? "Thin"
                        : s.status === "STRONG" || s.status === "OK"
                          ? "Strong"
                          : s.status}
                          </span>
                        </div>
                <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                  {s.reason}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {s.actions.map((a) => (
                          <Link
                      key={a.id}
                      to={a.href}
                            style={{
                        padding: "6px 12px",
                              fontSize: 12,
                        fontWeight: 600,
                        background: "#dcfce7",
                        color: "#166534",
                        border: "1px solid #86efac",
                        borderRadius: 6,
                              textDecoration: "none",
                            }}
                          >
                      {a.label}
                          </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
            </div>
          )}

      {response.answer.citations && response.answer.citations.length > 0 && (
        <CitationsList
          citations={response.answer.citations}
          usedSources={response.usedSources}
          defaultQuotesExpanded={false}
          studentMode={true}
          lessonId={lessonId}
          sectionTitle="Where this came from"
          showEvidenceLabel="Show evidence"
          introNote="Evidence from your course content."
        />
      )}

      {onFollowUpPrompt &&
        (response.answer.explanation?.trim() ||
          (response.answer.keyPoints && response.answer.keyPoints.length > 0)) && (
          <div style={{ marginTop: 14, marginBottom: 4 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#15803d",
                marginBottom: 8,
              }}
            >
              Keep learning
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {LEARNING_FOLLOW_UPS.map(({ label, prompt }) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={followUpsDisabled}
                  onClick={() => onFollowUpPrompt(prompt)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    background: followUpsDisabled ? "#e2e8f0" : "#fff",
                    color: followUpsDisabled ? "#94a3b8" : "#166534",
                    border: "1px solid #86efac",
                    borderRadius: 8,
                    cursor: followUpsDisabled ? "not-allowed" : "pointer",
                    textAlign: "left",
                    lineHeight: 1.3,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

      {response.suggestedActions && response.suggestedActions.length > 0 && (
        <SuggestedActionsBar
          actions={response.suggestedActions}
          mode="student"
          onIntent={onIntent}
          onActionClick={
            enquiryLogId
              ? (actionId) => postEnquiryAction(enquiryLogId, actionId).catch(() => {})
              : undefined
          }
        />
      )}

        </div>
  );
}
