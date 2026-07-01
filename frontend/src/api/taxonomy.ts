/**
 * Taxonomy API — fetch AQA GCSE Biology or Chemistry taxonomy by spec;
 * create-lesson-options for Subject → Spec → Main Topic → Sub-topic dropdowns.
 */
import api from "../services/api";
import { getSpecIdentity, SPEC_IDENTITY, type SpecIdentity } from "../utils/specIdentity";

export type CreateLessonSubTopic = {
  title: string;
  topicSlug: string;
  topicKey: string;
  path: string;
  /** When true, topic is a folder only — excluded from API; optional client guard */
  isGroup?: boolean;
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
  topicKey?: string;
};

export type TaxonomySection = {
  title: string;
  slug: string;
  topics: TaxonomyTopic[];
};

export type TaxonomyUnit = {
  unit: string;
  key?: string;
  topics: TaxonomyTopic[];
  sections?: TaxonomySection[];
};

export type TaxonomyResponse = {
  subject: string;
  examBoard: string;
  level: string;
  specKey?: string;
  displayName?: string;
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
  | "aqa-gcse-english-language"
  | "edexcel-igcse-biology";

export const SPEC_DISPLAY_LABELS: Record<SpecKey, string> = {
  "aqa-gcse-biology": "AQA GCSE Biology",
  "aqa-gcse-chemistry": "AQA GCSE Chemistry",
  "aqa-gcse-physics": "AQA GCSE Physics",
  "aqa-gcse-maths-foundation": "AQA GCSE Maths (Foundation)",
  "aqa-gcse-maths-higher": "AQA GCSE Maths (Higher)",
  "aqa-l2-further-maths": "AQA Further Maths (Level 2)",
  "aqa-gcse-english-literature": "AQA GCSE English Literature",
  "aqa-gcse-english-language": "AQA GCSE English Language",
  "edexcel-igcse-biology": "Edexcel IGCSE Biology",
};

export { getSpecIdentity, SPEC_IDENTITY, type SpecIdentity };

export function getSpecDisplayLabel(specKey: SpecKey): string {
  return SPEC_DISPLAY_LABELS[specKey] || "Topic";
}

export function getSpecTopicFieldLabel(specKey: SpecKey): string {
  const label = SPEC_DISPLAY_LABELS[specKey];
  return label ? `Topic (${label})` : "Topic";
}

/** Subject / exam board / level for question forms — derived from active taxonomy. */
export function getSpecFormMetadataFromTaxonomy(
  taxonomy: Pick<TaxonomyResponse, "subject" | "examBoard" | "level"> | null | undefined
): { subject: string; examBoard: string; level: string } {
  return {
    subject: taxonomy?.subject?.trim() || "Biology",
    examBoard: taxonomy?.examBoard?.trim() || "AQA",
    level: taxonomy?.level?.trim() || "GCSE",
  };
}

export async function fetchTaxonomy(specKey: SpecKey): Promise<TaxonomyResponse> {
  const res = await api.get<TaxonomyResponse>(`/taxonomy/${specKey}`);
  return res.data;
}

/** Resolve topic display name (e.g. "Animal and plant cells") to namespaced topicKey. Use when lesson.topicKey is missing. */
export async function resolveTopicDisplayToKey(
  specKey: string,
  topicDisplay: string,
  extra?: { subTopic?: string | null; title?: string | null }
): Promise<string | null> {
  const res = await api.get<{ topicKey: string | null; resolved: boolean }>("/taxonomy/resolve-topic", {
    params: {
      specKey: specKey.trim(),
      topic: topicDisplay.trim(),
      ...(extra?.subTopic ? { subTopic: String(extra.subTopic).trim() } : {}),
      ...(extra?.title ? { title: String(extra.title).trim() } : {}),
    },
  });
  return res.data?.resolved ? res.data.topicKey : null;
}
