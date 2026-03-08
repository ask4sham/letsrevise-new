/**
 * Taxonomy API — fetch AQA GCSE Biology or Chemistry taxonomy by spec;
 * create-lesson-options for Subject → Spec → Main Topic → Sub-topic dropdowns.
 */
import api from "../services/api";

export type CreateLessonSubTopic = {
  title: string;
  topicSlug: string;
  topicKey: string;
  path: string;
};

export type CreateLessonMainTopic = {
  title: string;
  subTopics: CreateLessonSubTopic[];
};

export type CreateLessonSpec = {
  specKey: string;
  specLabel: string;
  mainTopics: CreateLessonMainTopic[];
};

export type CreateLessonSubject = {
  subject: string;
  specs: CreateLessonSpec[];
};

export type CreateLessonOptionsResponse = {
  subjects: CreateLessonSubject[];
};

export async function fetchCreateLessonOptions(): Promise<CreateLessonOptionsResponse> {
  const res = await api.get<CreateLessonOptionsResponse>("/taxonomy/create-lesson-options");
  return res.data;
}

export type TaxonomyTopic = {
  topic: string;
  key: string;
  tier: Array<"foundation" | "higher">;
  requiredPractical: boolean;
};

export type TaxonomyUnit = {
  unit: string;
  topics: TaxonomyTopic[];
};

export type TaxonomyResponse = {
  subject: string;
  examBoard: string;
  level: string;
  specKey?: string;
  units: TaxonomyUnit[];
};

export type SpecKey =
  | "aqa-gcse-biology"
  | "aqa-gcse-chemistry"
  | "aqa-gcse-physics"
  | "aqa-gcse-maths-foundation"
  | "aqa-gcse-maths-higher"
  | "aqa-l2-further-maths"
  | "aqa-gcse-english-literature"
  | "aqa-gcse-english-language";

export async function fetchTaxonomy(specKey: SpecKey): Promise<TaxonomyResponse> {
  const res = await api.get<TaxonomyResponse>(`/taxonomy/${specKey}`);
  return res.data;
}

/** Resolve topic display name (e.g. "Animal and plant cells") to namespaced topicKey. Use when lesson.topicKey is missing. */
export async function resolveTopicDisplayToKey(
  specKey: string,
  topicDisplay: string
): Promise<string | null> {
  const res = await api.get<{ topicKey: string | null; resolved: boolean }>("/taxonomy/resolve-topic", {
    params: { specKey: specKey.trim(), topic: topicDisplay.trim() },
  });
  return res.data?.resolved ? res.data.topicKey : null;
}
