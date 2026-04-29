/**
 * Opt-in presets for `dragDropMatch` blocks — only applied when the teacher explicitly chooses a template.
 */

export const DRAG_DROP_TEMPLATE_CELL_ORGANELLES_ID = "cell-organelles-gcse" as const;

/** Editor template: cell organelles → functions (GCSE AQA-friendly). */
export const CELL_ORGANELLES_DRAG_DROP_TEMPLATE: Array<{
  prompt: string;
  answer: string;
  explanation: string;
}> = [
  { prompt: "Nucleus", answer: "Controls the cell and contains genetic material", explanation: "" },
  { prompt: "Cytoplasm", answer: "Jelly-like substance where many chemical reactions happen", explanation: "" },
  { prompt: "Cell membrane", answer: "Controls what enters and leaves the cell", explanation: "" },
  { prompt: "Mitochondria", answer: "Site of aerobic respiration", explanation: "" },
  { prompt: "Ribosomes", answer: "Where proteins are made", explanation: "" },
  { prompt: "Chloroplasts", answer: "Site of photosynthesis", explanation: "" },
  { prompt: "Cell wall", answer: "Supports and strengthens plant cells", explanation: "" },
  { prompt: "Vacuole", answer: "Contains cell sap and helps keep plant cells firm", explanation: "" },
];
