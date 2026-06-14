/**
 * P1 GCSE Visual Explanation API.
 */
import api from "../services/api";

export type VisualExplanationKeyPart = {
  label: string;
  what: string;
};

export type VisualExplanationContent = {
  what_image_shows: string;
  key_parts: VisualExplanationKeyPart[];
  step_by_step: string[];
  why_it_matters_gcse: string;
  common_mistake: string;
  exam_tip: string;
  exam_question: string;
  model_answer: string;
};

export type GenerateVisualExplanationParams = {
  topic: string;
  context?: string | null;
  subject?: string;
  exam_board?: string;
  tier?: string;
  lesson_id?: string | null;
  block_key?: string | null;
};

export type GenerateVisualExplanationResponse = {
  id: string;
  lesson_id: string | null;
  block_key: string | null;
  topic: string;
  subject: string;
  exam_board: string;
  tier: string;
  explanation: VisualExplanationContent;
  image_data_url: string | null;
  image_mime_type: string | null;
  provider_status: "image_generated" | "image_provider_unavailable";
  created_at: string;
};

export async function generateVisualExplanation(
  payload: GenerateVisualExplanationParams
): Promise<GenerateVisualExplanationResponse> {
  const res = await api.post<GenerateVisualExplanationResponse>(
    "/visual-explanations/generate",
    payload,
    { timeout: 150_000 }
  );
  return res.data;
}
