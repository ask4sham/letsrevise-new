/**
 * PR-007: Feature flag API for frontend.
 */
import api from "../services/api";

export type AiTutorFlagResponse = {
  enabled: boolean;
};

/**
 * Check if AI Tutor is enabled for the given specKey.
 * Cached client-side for the session (caller should cache).
 */
export async function getAiTutorEnabled(specKey: string): Promise<boolean> {
  const res = await api.get<AiTutorFlagResponse>("/feature-flags/ai-tutor", {
    params: { specKey: specKey?.trim() || "" },
  });
  return res.data?.enabled === true;
}

export type VisualExplanationFlagResponse = {
  enabled: boolean;
};

export async function getVisualExplanationEnabled(): Promise<boolean> {
  const res = await api.get<VisualExplanationFlagResponse>("/feature-flags/visual-explanation");
  return res.data?.enabled === true;
}
