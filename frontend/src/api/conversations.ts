/**
 * PR-019: Conversations API — threaded tutoring chat.
 */
import api from "../services/api";

export type CreateConversationParams = {
  specKey: string;
  topicKey?: string;
  lessonId?: string;
};

export type ConversationMessage = {
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  enquiryLogId?: string | null;
};

export type Conversation = {
  conversationId: string;
  specKey: string;
  topicKey: string | null;
  lessonId: string | null;
  messages: ConversationMessage[];
};

export async function createConversation(
  params: CreateConversationParams
): Promise<{ conversationId: string }> {
  const res = await api.post<{ conversationId: string }>("/conversations", {
    specKey: params.specKey.trim(),
    topicKey: params.topicKey?.trim() || undefined,
    lessonId: params.lessonId || undefined,
  });
  return res.data;
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  const res = await api.get<Conversation>(`/conversations/${conversationId}`);
  return res.data;
}

export async function listConversations(params?: {
  specKey?: string;
  topicKey?: string;
  limit?: number;
}): Promise<{ conversations: Array<{ conversationId: string; specKey: string; topicKey: string | null; lessonId: string | null; createdAt: string; updatedAt: string }> }> {
  const searchParams = new URLSearchParams();
  if (params?.specKey) searchParams.set("specKey", params.specKey);
  if (params?.topicKey) searchParams.set("topicKey", params.topicKey);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  const res = await api.get(`/conversations${qs ? `?${qs}` : ""}`);
  return res.data;
}
