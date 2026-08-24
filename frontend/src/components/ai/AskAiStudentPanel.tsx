/**
 * Ask Sham V1 — question → AI → direct GCSE answer.
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import { postEnquiry, type PostEnquiryResponse } from "../../api/enquiry";
import { createConversation, getConversation } from "../../api/conversations";
import { ASK_SHAM_HEADING } from "../../utils/askAiStudentLessonNative";

const ASK_SHAM_SUBCOPY = "Ask me anything.";
const ASK_SHAM_PLACEHOLDER = "Ask me anything…";
const ASK_SHAM_UNAVAILABLE =
  "Ask Sham isn't available right now. Please try again shortly.";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type Props = {
  topicKey: string;
  specKey: string;
  lessonId?: string;
  lessonTitle?: string;
  pageTitle?: string;
  suppressAutoScroll?: boolean;
};

const SESSION_KEY_PREFIX = "askai:conv:student:";

function getSessionKey(specKey: string, topicKey: string, lessonId?: string): string {
  return `${SESSION_KEY_PREFIX}${specKey}:${topicKey}:${lessonId || ""}`;
}

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

export function AskAiStudentPanel({
  topicKey,
  specKey,
  lessonId,
  suppressAutoScroll = false,
}: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationInitFailed, setConversationInitFailed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sessionKey = getSessionKey(specKey, topicKey, lessonId);

  const loadConversation = useCallback((id: string) => {
    getConversation(id, { limit: 40 })
      .then((conv) => {
        const mapped = conv.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          text: m.text,
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
    if (suppressAutoScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, suppressAutoScroll]);

  const sendQuestion = useCallback(
    async (message: string) => {
      const q = message.trim();
      if (!q || loading) return;

      const convId = conversationId;
      if (!convId && !conversationInitFailed) return;

      setLoading(true);
      setError(null);
      if (q === question.trim()) setQuestion("");
      setMessages([{ role: "user", text: q }]);

      try {
        const res: PostEnquiryResponse = await postEnquiry({
          question: q,
          specKey,
          topicKey,
          conversationId: convId || undefined,
          mode: "lesson",
          includePractice: false,
          responseMode: "explain",
          lessonId: lessonId || undefined,
        });

        const answerText = (res.answer.explanation || "").trim();
        setMessages([
          { role: "user", text: q },
          { role: "assistant", text: answerText },
        ]);
      } catch {
        setError(ASK_SHAM_UNAVAILABLE);
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, conversationInitFailed, loading, question, specKey, topicKey, lessonId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendQuestion(question.trim());
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
      id="lesson-ask-ai-tutor"
      style={{
        marginTop: 24,
        padding: "1rem 1.25rem",
        borderRadius: 12,
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#166534", fontSize: "1.1rem" }}>
        {ASK_SHAM_HEADING}
      </div>
      <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#15803d" }}>{ASK_SHAM_SUBCOPY}</p>

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
                data-testid="ask-sham-answer"
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#fff",
                  color: "#334155",
                  border: "1px solid #bbf7d0",
                  fontSize: 15,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {latestAssistant.text}
              </div>
            )}
          </div>
        )}
        {loading && (
          <div style={{ marginBottom: 12, fontSize: 14, color: "#64748b" }}>
            Thinking…
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
          id="lesson-ask-ai-tutor-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={ASK_SHAM_PLACEHOLDER}
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
          {loading ? "Thinking…" : "Ask Sham"}
        </button>
      </form>
    </div>
  );
}
