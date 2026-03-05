/**
 * PR-019: Conversations API — threaded tutoring chat.
 * PR-019.1: Pagination, title, lastMessageAt, list filters.
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

export type ConversationPagination = {
  limit: number;
  hasMore: boolean;
  oldestReturnedAt: string | null;
};

export type Conversation = {
  conversationId: string;
  specKey: string;
  topicKey: string | null;
  lessonId: string | null;
  messages: ConversationMessage[];
  pagination?: ConversationPagination;
};

export type ConversationListItem = {
  conversationId: string;
  title: string;
  lastMessageAt: string | null;
  specKey: string;
  topicKey: string | null;
  lessonId: string | null;
  createdAt: string;
  updatedAt: string;
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

export async function getConversation(
  conversationId: string,
  params?: { limit?: number; before?: string }
): Promise<Conversation> {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.before) searchParams.set("before", params.before);
  const qs = searchParams.toString();
  const res = await api.get<Conversation>(
    `/conversations/${conversationId}${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

export async function listConversations(params?: {
  specKey?: string;
  topicKey?: string;
  lessonId?: string;
  limit?: number;
  mineOnly?: boolean;
}): Promise<{ conversations: ConversationListItem[] }> {
  const searchParams = new URLSearchParams();
  if (params?.specKey) searchParams.set("specKey", params.specKey);
  if (params?.topicKey) searchParams.set("topicKey", params.topicKey);
  if (params?.lessonId) searchParams.set("lessonId", params.lessonId);
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.mineOnly === false) searchParams.set("mineOnly", "false");
  const qs = searchParams.toString();
  const res = await api.get<{ conversations: ConversationListItem[] }>(
    `/conversations${qs ? `?${qs}` : ""}`
  );
  return res.data;
}
