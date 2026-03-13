/**
 * PR-022: External source moderation API.
 * Teacher/admin only.
 */
import api from "../services/api";

export type ExternalSourceRecentItem = {
  enquiryLogId: string;
  question: string;
  specKey: string;
  topicKey: string;
  url: string;
  domain: string;
  title: string;
  createdAt: string;
};

export type ExternalSourcePolicy = {
  _id: string;
  kind: "url" | "domain";
  value: string;
  status: "allowed" | "denied";
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

export async function getExternalRecent(params?: {
  specKey?: string;
  topicKey?: string;
  limit?: number;
}): Promise<{ items: ExternalSourceRecentItem[] }> {
  const search = new URLSearchParams();
  if (params?.specKey) search.set("specKey", params.specKey);
  if (params?.topicKey) search.set("topicKey", params.topicKey);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await api.get<{ items: ExternalSourceRecentItem[] }>(
    `/external-sources/recent${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

export async function listPolicies(params?: {
  status?: "allowed" | "denied";
  kind?: "url" | "domain";
  q?: string;
}): Promise<{ items: ExternalSourcePolicy[] }> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.kind) search.set("kind", params.kind);
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  const res = await api.get<{ items: ExternalSourcePolicy[] }>(
    `/external-sources/policies${qs ? `?${qs}` : ""}`
  );
  return res.data;
}

export async function upsertPolicy(body: {
  kind: "url" | "domain";
  value: string;
  status: "allowed" | "denied";
  reason?: string;
}): Promise<ExternalSourcePolicy> {
  const res = await api.post<ExternalSourcePolicy>("/external-sources/policies", body);
  return res.data;
}

export async function deletePolicy(id: string): Promise<void> {
  await api.delete(`/external-sources/policies/${id}`);
}

export async function promoteExternal(body: {
  enquiryLogId: string;
  url?: string;
  title?: string;
  snippet?: string;
  specKey: string;
  topicKey: string;
  noteTitle?: string;
  noteText?: string;
}): Promise<{ teacherNoteKnowledgeDocumentId: string; created: boolean }> {
  const res = await api.post<{ teacherNoteKnowledgeDocumentId: string; created: boolean }>(
    "/external-sources/promote",
    body
  );
  return res.data;
}
