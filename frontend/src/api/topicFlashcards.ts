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
  specKey?: string;
  status?: "draft" | "published" | "all";
  mineOnly?: boolean;
  /** Unit slug for legacy unit__topic format matching (e.g. "cell-biology") */
  unitKey?: string;
};

export async function listTopicFlashcards(params: ListParams = {}): Promise<TopicFlashcard[]> {
  const q = new URLSearchParams();
  if (params.topicKey) q.set("topicKey", params.topicKey);
  if (params.specKey) q.set("specKey", params.specKey);
  if (params.status) q.set("status", params.status);
  if (params.mineOnly) q.set("mineOnly", "1");
  if (params.unitKey) q.set("unitKey", params.unitKey);
  const res = await api.get<{ items: TopicFlashcard[] }>(
    `/topic-flashcards${q.toString() ? `?${q.toString()}` : ""}`
  );
  return res.data?.items ?? [];
}

export async function createTopicFlashcard(body: {
  topicKey: string;
  specKey?: string;
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
  specKey?: string;
  format: "json" | "newline" | "csv";
  text: string;
  dedupeMode?: "skip" | "error" | "allow";
  csvOptions?: { delimiter?: "," | "\t" | ";"; skipEmptyLines?: boolean };
}): Promise<BulkPreviewResponse> {
  const res = await api.post<BulkPreviewResponse>("/topic-flashcards/bulk/preview", {
    topicKey: params.topicKey,
    specKey: params.specKey,
    format: params.format,
    text: params.text,
    dedupeMode: params.dedupeMode ?? "skip",
    csvOptions: params.csvOptions,
  });
  return res.data!;
}

export async function bulkCreateTopicFlashcards(body: {
  topicKey: string;
  specKey?: string;
  topic?: string;
  items: Array<{ front: string; back: string; tags?: string[]; topic?: string }>;
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
    specKey: body.specKey,
    topic: body.topic,
    items: body.items,
    dedupeMode: body.dedupeMode ?? "skip",
  });
  return res.data!;
}

/** Bulk import from raw text (format + text). Server parses and inserts. */
export async function bulkCreateTopicFlashcardsFromText(body: {
  topicKey: string;
  specKey?: string;
  topic?: string;
  format: "csv" | "newline" | "json";
  text: string;
  dedupeMode?: "skip" | "error" | "allow";
  csvOptions?: { skipEmptyLines?: boolean; delimiter?: string };
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
    specKey: body.specKey,
    topic: body.topic,
    format: body.format,
    text: body.text,
    dedupeMode: body.dedupeMode ?? "skip",
    csvOptions: body.csvOptions ?? { skipEmptyLines: true },
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

/** Admin only: move flashcard to another topic. */
export async function reassignTopicFlashcard(
  id: string,
  body: { topicKey: string; specKey?: string; topic?: string }
): Promise<TopicFlashcard> {
  const res = await api.post<{ flashcard: TopicFlashcard }>(`/topic-flashcards/${id}/reassign`, body);
  return res.data!.flashcard;
}

export async function publishTopicFlashcard(id: string): Promise<TopicFlashcard> {
  const res = await api.post<{ flashcard: TopicFlashcard }>(`/topic-flashcards/${id}/publish`, {});
  return res.data!.flashcard;
}

export async function unpublishTopicFlashcard(id: string): Promise<TopicFlashcard> {
  const res = await api.post<{ flashcard: TopicFlashcard }>(`/topic-flashcards/${id}/unpublish`, {});
  return res.data!.flashcard;
}

export type BulkPublishResult = { ok: boolean; matchedCount: number; updatedCount: number };

export async function bulkPublishTopicFlashcards(ids: string[]): Promise<BulkPublishResult> {
  const res = await api.post<BulkPublishResult>("/topic-flashcards/bulk/publish", { ids });
  return res.data!;
}

export async function bulkUnpublishTopicFlashcards(ids: string[]): Promise<BulkPublishResult> {
  const res = await api.post<BulkPublishResult>("/topic-flashcards/bulk/unpublish", { ids });
  return res.data!;
}

export async function generateFlashcardsFromTopic(
  lessonId: string,
  topicKey?: string | null
): Promise<{
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
  }>(`/lessons/${lessonId}/generate/flashcards-from-topic`, { topicKey: topicKey ?? undefined });
  return res.data!;
}

/** Sync lesson flashcards from topic bank: refresh existing topic-bank cards + add missing; teacher-made cards untouched. */
export async function syncFlashcardsFromTopicBank(
  lessonId: string,
  topicKey?: string | null
): Promise<{
  ok: boolean;
  syncedCount: number;
  added?: number;
  updated?: number;
  topicBankCount?: number;
  flashcardsCount: number;
  flashcards: Array<{ id: string; front: string; back: string; tags?: string[]; difficulty?: number; source?: string; topicBankId?: string }>;
  lesson?: unknown;
}> {
  const res = await api.post<{
    ok: boolean;
    syncedCount: number;
    added?: number;
    updated?: number;
    topicBankCount?: number;
    flashcardsCount: number;
    flashcards: Array<{ id: string; front: string; back: string; tags?: string[]; difficulty?: number; source?: string; topicBankId?: string }>;
    lesson?: unknown;
  }>(`/lessons/${lessonId}/sync-topic-bank/flashcards`, { topicKey: topicKey ?? undefined });
  return res.data!;
}

/** @deprecated Use generateFlashcardsFromTopic; alias calls same handler. */
export async function seedLessonFlashcardsFromTopic(
  lessonId: string,
  topicKey?: string | null
): Promise<{
  ok: boolean;
  addedCount: number;
  added: number;
  flashcardsCount: number;
  message?: string;
}> {
  return generateFlashcardsFromTopic(lessonId, topicKey);
}
