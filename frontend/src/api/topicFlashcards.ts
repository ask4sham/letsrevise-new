/**
 * PR-F1: Topic Flashcard Bank API (teacher/admin only).
 */
import api from "../services/api";

export type TopicFlashcard = {
  _id: string;
  ownerId: string;
  subject?: string;
  examBoard?: string;
  level?: string;
  topicKey: string;
  topic?: string;
  front: string;
  back: string;
  status: "draft" | "published";
  createdAt?: string;
  updatedAt?: string;
};

export type ListParams = {
  topicKey?: string;
  status?: "draft" | "published" | "all";
  mineOnly?: boolean;
};

export async function listTopicFlashcards(params: ListParams = {}): Promise<TopicFlashcard[]> {
  const q = new URLSearchParams();
  if (params.topicKey) q.set("topicKey", params.topicKey);
  if (params.status) q.set("status", params.status);
  if (params.mineOnly) q.set("mineOnly", "1");
  const res = await api.get<{ items: TopicFlashcard[] }>(
    `/topic-flashcards${q.toString() ? `?${q.toString()}` : ""}`
  );
  return res.data?.items ?? [];
}

export async function createTopicFlashcard(body: {
  topicKey: string;
  topic?: string;
  front: string;
  back: string;
  status?: "draft" | "published";
}): Promise<TopicFlashcard> {
  const res = await api.post<{ flashcard: TopicFlashcard }>("/topic-flashcards", body);
  return res.data!.flashcard;
}

export async function bulkCreateTopicFlashcards(body: {
  topicKey: string;
  topic?: string;
  items: Array<{ front: string; back: string; tags?: string[] }>;
}): Promise<{ createdCount: number; createdIds: string[] }> {
  const res = await api.post<{ createdCount: number; createdIds: string[] }>(
    "/topic-flashcards/bulk",
    { topicKey: body.topicKey, topic: body.topic, items: body.items }
  );
  return res.data!;
}

export async function updateTopicFlashcard(
  id: string,
  updates: { front?: string; back?: string; status?: "draft" | "published" }
): Promise<TopicFlashcard> {
  const res = await api.put<{ flashcard: TopicFlashcard }>(`/topic-flashcards/${id}`, updates);
  return res.data!.flashcard;
}

export async function deleteTopicFlashcard(id: string): Promise<void> {
  await api.delete(`/topic-flashcards/${id}`);
}

export async function publishTopicFlashcard(id: string): Promise<TopicFlashcard> {
  const res = await api.post<{ flashcard: TopicFlashcard }>(`/topic-flashcards/${id}/publish`, {});
  return res.data!.flashcard;
}

export async function unpublishTopicFlashcard(id: string): Promise<TopicFlashcard> {
  const res = await api.post<{ flashcard: TopicFlashcard }>(`/topic-flashcards/${id}/unpublish`, {});
  return res.data!.flashcard;
}

export async function seedLessonFlashcardsFromTopic(lessonId: string): Promise<{
  ok: boolean;
  added: number;
  flashcardsCount: number;
  message?: string;
}> {
  const res = await api.post<{ ok: boolean; added: number; flashcardsCount: number; message?: string }>(
    `/lessons/${lessonId}/seed-flashcards-from-topic`
  );
  return res.data!;
}
