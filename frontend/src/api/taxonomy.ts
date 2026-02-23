/**
 * Taxonomy API — fetch AQA GCSE Biology or Chemistry taxonomy by spec.
 */
import api from "../services/api";

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

export type SpecKey = "aqa-gcse-biology" | "aqa-gcse-chemistry" | "aqa-gcse-physics";

export async function fetchTaxonomy(specKey: SpecKey): Promise<TaxonomyResponse> {
  const res = await api.get<TaxonomyResponse>(`/taxonomy/${specKey}`);
  return res.data;
}
