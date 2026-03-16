/**
 * Admin Taxonomy API — rename, delete, move main topics and sub-topics.
 */
import api from "../services/api";

export type LinkedCounts = {
  lessons: number;
  flashcards: number;
  quizzes: number;
  examQuestions: number;
};

export type AdminTaxonomyItem = {
  _id: string;
  type: "unit" | "subTopic";
  specKey: string;
  unit?: string;
  unitKey?: string;
  topic?: string;
  key?: string;
  topicKey?: string;
};

/** Rename main topic. PATCH /api/admin/taxonomy/main-topic/:id */
export async function renameMainTopic(id: string, payload: { title?: string; slug?: string }): Promise<{ item: AdminTaxonomyItem }> {
  const res = await api.patch<{ item: AdminTaxonomyItem }>(`/admin/taxonomy/main-topic/${id}`, payload);
  return res.data;
}

/** Rename sub-topic. PATCH /api/admin/taxonomy/sub-topic/:id */
export async function renameSubTopic(id: string, payload: { title?: string; slug?: string }): Promise<{ item: AdminTaxonomyItem }> {
  const res = await api.patch<{ item: AdminTaxonomyItem }>(`/admin/taxonomy/sub-topic/${id}`, payload);
  return res.data;
}

/** Delete main topic. DELETE /api/admin/taxonomy/main-topic/:id. Returns 409 with linkedCounts when blocked. */
export async function deleteMainTopic(id: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/admin/taxonomy/main-topic/${id}`);
  return res.data;
}

/** Delete sub-topic. DELETE /api/admin/taxonomy/sub-topic/:id. Returns 409 with linkedCounts when blocked. */
export async function deleteSubTopic(id: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/admin/taxonomy/sub-topic/${id}`);
  return res.data;
}

/** Move sub-topic to another main topic. POST /api/admin/taxonomy/sub-topic/:id/move */
export async function moveSubTopic(id: string, targetMainTopicId: string): Promise<{ item: AdminTaxonomyItem }> {
  const res = await api.post<{ item: AdminTaxonomyItem }>(`/admin/taxonomy/sub-topic/${id}/move`, { targetMainTopicId });
  return res.data;
}

/** Delete section. DELETE /api/admin/taxonomy/section/:id. Topics under it revert to direct under main topic. */
export async function deleteSection(id: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/admin/taxonomy/section/${id}`);
  return res.data;
}
