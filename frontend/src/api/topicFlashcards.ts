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

export type BulkPreviewSummary = {
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  duplicatesInPayload: number;
  duplicatesInDb: number;
  wouldCreate: number;
};

export type BulkPreviewResponse = {
  ok: boolean;
  topicKey: string;
  summary: BulkPreviewSummary;
  invalid: Array<{ index: number; reason: string; raw: string }>;
  duplicates: {
    inPayload: Array<{ index: number; front: string; back: string }>;
    inDb: Array<{ front: string; back: string }>;
  };
  previewItems: Array<{ front: string; back: string; tags: string[]; fingerprint: string }>;
};

export async function previewBulkImportTopicFlashcards(params: {
  topicKey: string;
  format: "json" | "newline" | "csv";
  text: string;
  dedupeMode?: "skip" | "error" | "allow";
  csvOptions?: { delimiter?: "," | "\t" | ";" };
}): Promise<BulkPreviewResponse> {
  const res = await api.post<BulkPreviewResponse>("/topic-flashcards/bulk/preview", {
    topicKey: params.topicKey,
    format: params.format,
    text: params.text,
    dedupeMode: params.dedupeMode ?? "skip",
    csvOptions: params.csvOptions,
  });
  return res.data!;
}

export async function bulkCreateTopicFlashcards(body: {
  topicKey: string;
  topic?: string;
  items: Array<{ front: string; back: string; tags?: string[] }>;
  dedupeMode?: "skip" | "error" | "allow";
}): Promise<{
  ok: boolean;
  createdCount: number;
  skipped: { duplicatesInPayload: number; duplicatesInDb: number; invalid: number };
  createdIds: string[];
}> {
  const res = await api.post<{
    ok: boolean;
    createdCount: number;
    skipped: { duplicatesInPayload: number; duplicatesInDb: number; invalid: number };
    createdIds: string[];
  }>("/topic-flashcards/bulk", {
    topicKey: body.topicKey,
    topic: body.topic,
    items: body.items,
    dedupeMode: body.dedupeMode ?? "skip",
  });
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

export async function generateFlashcardsFromTopic(lessonId: string): Promise<{
  ok: boolean;
  addedCount: number;
  added: number;
  flashcardsCount: number;
  message?: string;
}> {
  const res = await api.post<{
    ok: boolean;
    addedCount: number;
    added: number;
    flashcardsCount: number;
    message?: string;
  }>(`/lessons/${lessonId}/generate/flashcards-from-topic`);
  return res.data!;
}

/** @deprecated Use generateFlashcardsFromTopic; alias calls same handler. */
export async function seedLessonFlashcardsFromTopic(lessonId: string): Promise<{
  ok: boolean;
  addedCount: number;
  added: number;
  flashcardsCount: number;
  message?: string;
}> {
  return generateFlashcardsFromTopic(lessonId);
}
