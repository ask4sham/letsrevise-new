/**
 * PR-023: Teacher notes API — topic-scoped listing.
 * Teacher/admin only.
 */
import api from "../services/api";

export type TeacherNoteItem = {
  knowledgeDocumentId: string;
  title: string;
  textSnippet: string;
  metadata: {
    url?: string;
    domain?: string;
    fetchedAt?: string;
    enquiryLogId?: string;
    createdBy?: string;
  };
  updatedAt: string;
};

export async function getTeacherNotes(params: {
  specKey: string;
  topicKey?: string;
  limit?: number;
}): Promise<{ items: TeacherNoteItem[] }> {
  const search = new URLSearchParams();
  search.set("specKey", params.specKey.trim());
  if (params.topicKey?.trim()) search.set("topicKey", params.topicKey.trim());
  if (params.limit) search.set("limit", String(params.limit));
  const res = await api.get<{ items: TeacherNoteItem[] }>(`/teacher-notes?${search.toString()}`);
  return res.data;
}
