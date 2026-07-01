/** Board / level / exam code per spec — shared by manual editor, AI generator, and banks. */
export type SpecIdentity = { board: string; level: string; examCode: string };

export const SPEC_IDENTITY: Record<string, SpecIdentity> = {
  "aqa-gcse-biology": { board: "AQA", level: "GCSE", examCode: "8461" },
  "edexcel-igcse-biology": { board: "Edexcel", level: "IGCSE", examCode: "4BI1" },
};

export function getSpecIdentity(specKey: string): SpecIdentity | null {
  const key = (specKey || "").trim();
  return SPEC_IDENTITY[key] ?? null;
}
